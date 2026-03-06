import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class ViewerTokenService {
  constructor(private readonly jwtService: JwtService) {}

  generateViewerToken(
    familyId: string,
    userId: string,
  ): { token: string; url: string } {
    const token = this.jwtService.sign(
      { sub: userId, familyId, scope: 'viewer', type: 'viewer' },
      { expiresIn: '7d' },
    );

    const baseUrl =
      process.env.VIEWER_BASE_URL || 'http://localhost:5173';
    const url = `${baseUrl}/view/${familyId}/${token}`;

    return { token, url };
  }
}
