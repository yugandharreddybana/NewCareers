package com.careerops.email;

/**
 * Task 58 — Email invite helper for workspace collaboration.
 * The actual sending is delegated to EmailService which already
 * handles JavaMailSender / Resend configuration from Phase 2.
 */
public class WorkspaceInviteEmail {

    public static String buildSubject(String workspaceName) {
        return "You've been invited to collaborate on \"" + workspaceName + "\" on NewCareers";
    }

    public static String buildHtml(String recipientEmail, String workspaceName, String role, String token) {
        String acceptUrl = "https://app.newcareers.io/workspaces/invite/accept?token=" + token;
        return """
                <!DOCTYPE html>
                <html lang="en">
                <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
                <title>Workspace Invite</title></head>
                <body style="font-family:Inter,sans-serif;background:#f7f6f2;padding:40px 0;margin:0">
                  <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;
                              box-shadow:0 4px 24px rgba(0,0,0,.07);overflow:hidden">
                    <div style="background:#01696f;padding:32px 40px">
                      <h1 style="color:#fff;margin:0;font-size:22px;font-weight:600">NewCareers</h1>
                    </div>
                    <div style="padding:40px">
                      <h2 style="margin:0 0 12px;font-size:20px;color:#28251d">You've been invited to collaborate</h2>
                      <p style="color:#7a7974;font-size:15px;line-height:1.6;margin:0 0 24px">
                        You've been invited to join <strong style="color:#28251d">%s</strong>
                        as a <strong style="color:#28251d;text-transform:capitalize">%s</strong>.
                        Click the button below to accept and start collaborating.
                      </p>
                      <a href="%s"
                         style="display:inline-block;background:#01696f;color:#fff;text-decoration:none;
                                padding:14px 28px;border-radius:8px;font-weight:600;font-size:15px">
                        Accept Invitation
                      </a>
                      <p style="color:#bab9b4;font-size:12px;margin:32px 0 0">
                        This invite link expires in 72 hours. If you didn't expect this email, you can safely ignore it.
                      </p>
                    </div>
                  </div>
                </body>
                </html>
                """.formatted(workspaceName, role, acceptUrl);
    }

    public static String buildPlainText(String workspaceName, String role, String token) {
        return "You've been invited to join \"" + workspaceName + "\" as a " + role + " on NewCareers.\n\n"
                + "Accept your invite here: https://app.newcareers.io/workspaces/invite/accept?token=" + token + "\n\n"
                + "This invite expires in 72 hours.";
    }
}
