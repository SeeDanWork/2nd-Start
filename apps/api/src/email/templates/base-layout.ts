const APP_NAME = 'ADCP';

export function baseLayout(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${title}</title>
<style>
  body { margin:0; padding:0; background:#f4f4f7; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; }
  .wrapper { width:100%; background:#f4f4f7; padding:24px 0; }
  .container { max-width:580px; margin:0 auto; background:#ffffff; border-radius:8px; overflow:hidden; }
  .header { background:#4f46e5; padding:24px; text-align:center; }
  .header h1 { margin:0; color:#ffffff; font-size:20px; font-weight:600; }
  .body { padding:32px 24px; color:#333333; font-size:15px; line-height:1.6; }
  .body h2 { margin:0 0 16px; font-size:18px; color:#1a1a2e; }
  .body p { margin:0 0 16px; }
  .btn { display:inline-block; padding:12px 24px; background:#4f46e5; color:#ffffff; text-decoration:none; border-radius:6px; font-weight:600; font-size:15px; }
  .footer { padding:16px 24px; text-align:center; font-size:12px; color:#999999; border-top:1px solid #eeeeee; }
  .muted { color:#888888; font-size:13px; }
</style>
</head>
<body>
<div class="wrapper">
  <div class="container">
    <div class="header"><h1>${APP_NAME}</h1></div>
    <div class="body">${body}</div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.</p>
      <p class="muted">You received this email because you have an ${APP_NAME} account.</p>
    </div>
  </div>
</div>
</body>
</html>`;
}
