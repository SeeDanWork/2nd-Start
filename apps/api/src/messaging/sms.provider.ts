export const SMS_PROVIDER = 'SMS_PROVIDER';

export interface ISmsProvider {
  sendSms(to: string, body: string): Promise<{ sid: string; status: string }>;
  isValidPhoneNumber(phone: string): boolean;
}
