SEFS SMS Intake Setup

Webhook URL for Twilio:
https://wjfewzutxvjbbnnvbylo.supabase.co/functions/v1/sms-intake

Business contact/help phone:
+1 321-284-8168

Parser texting number:
+1 931-404-9990

Public SMS compliance URLs for Twilio:
https://sefs-sms-compliance.pages.dev/privacy
https://sefs-sms-compliance.pages.dev/terms

What is already deployed:
- Supabase tables: sms_intake_conversations, sms_intake_messages
- Supabase Edge Function: sms-intake
- Twilio account SID, Twilio phone number, webhook URL, and messaging service SID secrets

Required private secret:
Run this in PowerShell and paste the Twilio Auth Token privately into the command. Do not paste the token into chat.

supabase secrets set TWILIO_AUTH_TOKEN="paste_your_twilio_auth_token_here" --project-ref wjfewzutxvjbbnnvbylo
supabase functions deploy sms-intake --project-ref wjfewzutxvjbbnnvbylo --no-verify-jwt

Recommended sender allowlist:
After testing, limit the parser to the two approved texting phones.

supabase secrets set SEFS_SMS_ALLOWED_FROM="+1FIRSTPHONE,+1SECONDPHONE" --project-ref wjfewzutxvjbbnnvbylo
supabase functions deploy sms-intake --project-ref wjfewzutxvjbbnnvbylo --no-verify-jwt

Test texts:
HELP

Mike Bierfreund 9315551212 wants 600 sqft metallic at 123 Main St follow up in 3 days

If information is missing, the parser replies with one question at a time. When all required details are available, it creates a New Lead in Supabase.
