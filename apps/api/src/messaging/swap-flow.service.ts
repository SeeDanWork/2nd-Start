import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  User,
  FamilyMembership,
  OvernightAssignment,
  BaseScheduleVersion,
  Request,
  ConversationSession,
} from '../entities';
import { ParsedIntent } from '@adcp/shared';
import { ConversationService } from './conversation.service';
import { MessageSenderService } from './message-sender.service';
import {
  swapConfirmPrompt,
  swapRequestSent,
  swapCancelled,
  swapReviewPrompt,
  swapApproved,
  swapDeclined,
  swapApprovedNotification,
  swapDeclinedNotification,
  swapNoSchedule,
  swapNoAssignment,
  swapNoDateFound,
} from './templates/swap-request';

@Injectable()
export class SwapFlowService {
  private readonly logger = new Logger(SwapFlowService.name);

  constructor(
    private readonly conversationService: ConversationService,
    private readonly messageSenderService: MessageSenderService,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(FamilyMembership)
    private readonly membershipRepo: Repository<FamilyMembership>,
    @InjectRepository(OvernightAssignment)
    private readonly assignmentRepo: Repository<OvernightAssignment>,
    @InjectRepository(BaseScheduleVersion)
    private readonly scheduleVersionRepo: Repository<BaseScheduleVersion>,
    @InjectRepository(Request)
    private readonly requestRepo: Repository<Request>,
  ) {}

  /**
   * Initiate a swap request — extract date, look up assignment, ask for confirmation.
   */
  async initiateSwap(
    session: ConversationSession,
    parsed: ParsedIntent,
    user: User,
  ): Promise<string> {
    const dateStr = parsed.entities?.date;
    if (!dateStr) {
      return swapNoDateFound();
    }

    // Find active schedule for family
    const activeSchedule = await this.scheduleVersionRepo.findOne({
      where: { familyId: session.familyId!, isActive: true },
    });

    if (!activeSchedule) {
      return swapNoSchedule();
    }

    // Look up assignment for the requested date
    const assignment = await this.assignmentRepo.findOne({
      where: {
        scheduleVersionId: activeSchedule.id,
        date: dateStr,
      },
    });

    if (!assignment) {
      return swapNoAssignment(dateStr);
    }

    // Resolve the assigned parent's name
    const assignedParent = await this.userRepo.findOne({
      where: { id: assignment.assignedTo },
    });
    const parentName =
      assignedParent?.displayName ||
      (assignment.assignedTo === user.id ? 'you' : 'the other parent');

    // Set session to requesting state
    await this.conversationService.updateState(session.id, 'requesting');

    // Store pending action
    await this.conversationService.setPendingAction(session.id, {
      type: 'swap_confirm',
      data: {
        date: dateStr,
        currentAssignedTo: assignment.assignedTo,
        currentParentName: parentName,
      },
    });

    const displayName =
      assignment.assignedTo === user.id ? 'you have' : `${parentName} has`;
    return swapConfirmPrompt(dateStr, displayName);
  }

  /**
   * User confirmed the swap — create Request, notify other parent.
   */
  async confirmSwap(
    session: ConversationSession,
    user: User,
  ): Promise<string> {
    const pending = await this.conversationService.getPendingAction(session.id);
    if (!pending || pending.type !== 'swap_confirm') {
      return 'No pending swap to confirm.';
    }

    const { date } = pending.data;

    // Create a Request record
    const request = this.requestRepo.create({
      familyId: session.familyId!,
      requestedBy: user.id,
      type: 'swap_date',
      status: 'pending',
      dates: [date],
      reasonTag: 'swap',
      reasonNote: `Swap requested via SMS for ${date}`,
      urgency: 'normal',
      changeBudgetDebit: 1,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    });
    const savedRequest = await this.requestRepo.save(request);

    // Find the other parent in the family
    const memberships = await this.membershipRepo.find({
      where: { familyId: session.familyId! },
    });
    const otherMembership = memberships.find(
      (m) => m.userId && m.userId !== user.id,
    );

    if (!otherMembership || !otherMembership.userId) {
      this.logger.warn(
        `No other parent found in family ${session.familyId!} for swap request`,
      );
      return 'Request created, but no other parent found to notify.';
    }

    const otherUser = await this.userRepo.findOne({
      where: { id: otherMembership.userId },
    });

    if (!otherUser) {
      return 'Request created, but the other parent account was not found.';
    }

    // Send SMS to other parent
    if (otherUser.phoneNumber) {
      const reviewMessage = swapReviewPrompt(user.displayName, date);
      await this.messageSenderService.sendMessage(
        otherUser.phoneNumber,
        reviewMessage,
      );

      // Set the other parent's session to reviewing state
      const otherSession =
        await this.conversationService.getOrCreateSession(
          otherUser.id,
          session.familyId!,
          otherUser.phoneNumber,
          session.channel,
        );
      await this.conversationService.updateState(otherSession.id, 'reviewing');
      await this.conversationService.setPendingAction(otherSession.id, {
        type: 'swap_review',
        requestId: savedRequest.id,
        data: {
          date,
          requestingUserId: user.id,
          requestingUserName: user.displayName,
        },
      });
    }

    // Clear this user's pending action and reset state
    await this.conversationService.clearPendingAction(session.id);
    await this.conversationService.updateState(session.id, 'idle');

    const otherName = otherUser.displayName || 'the other parent';
    return swapRequestSent(otherName);
  }

  /**
   * User cancelled the swap request.
   */
  async cancelSwap(session: ConversationSession): Promise<string> {
    await this.conversationService.clearPendingAction(session.id);
    await this.conversationService.updateState(session.id, 'idle');
    return swapCancelled();
  }

  /**
   * Reviewing parent approves or declines the swap.
   */
  async handleSwapReview(
    session: ConversationSession,
    approved: boolean,
    user: User,
  ): Promise<string> {
    const pending = await this.conversationService.getPendingAction(session.id);
    if (!pending || pending.type !== 'swap_review') {
      return 'No pending swap review found.';
    }

    const { requestId } = pending;
    const { date, requestingUserId } = pending.data;

    if (!requestId) {
      return 'No request ID found in pending action.';
    }

    // Update the Request status
    const newStatus = approved ? 'accepted' : 'declined';
    await this.requestRepo.update(requestId, { status: newStatus } as any);

    // Clear reviewing session state
    await this.conversationService.clearPendingAction(session.id);
    await this.conversationService.updateState(session.id, 'idle');

    // Notify the requesting parent
    const requestingUser = await this.userRepo.findOne({
      where: { id: requestingUserId },
    });

    if (requestingUser?.phoneNumber) {
      const notification = approved
        ? swapApprovedNotification(date)
        : swapDeclinedNotification(date);
      await this.messageSenderService.sendMessage(
        requestingUser.phoneNumber,
        notification,
      );
    }

    return approved ? swapApproved() : swapDeclined();
  }
}
