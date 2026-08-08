SEFS SMS Intake Setup

Webhook URL for Twilio:
https://wjfewzutxvjbbnnvbylo.supabase.co/functions/v1/sms-intake

Business contact/help phone:
+1 321-284-8168

Parser texting number:
+1 931-404-9990

Public SMS compliance URLs for Twilio:
https://sefs-sms-compliance.pages.dev
https://sefs-sms-compliance.pages.dev/privacy
https://sefs-sms-compliance.pages.dev/terms

Twilio campaign fields:

Message flow / consent:
Recipients are Southeast Flooring Solutions employees or approved internal operations contacts. They opt in by texting START or YES to +1 931-404-9990 after being told verbally and/or shown the public opt-in instructions at https://sefs-sms-compliance.pages.dev. The public opt-in page states that recipients agree to receive job intake, scheduling, follow-up, and internal operations SMS messages from Southeast Flooring Solutions. Message frequency varies. Message and data rates may apply. Recipients can reply HELP for help or STOP to opt out. The page links to the SMS Privacy Policy and SMS Terms and Conditions. After texting START or YES, recipients receive the opt-in confirmation message listed in this campaign.

Opt-in keywords:
START,YES

Opt-in message:
Southeast Flooring Solutions: You are opted in for job intake, scheduling, follow-up, and operations SMS. Msg freq varies. Msg&data rates may apply. Privacy/Terms: https://sefs-sms-compliance.pages.dev Reply HELP for help. Reply STOP to opt out.

Help keywords:
HELP,INFO

Help message:
Southeast Flooring Solutions SMS help: call 321-284-8168. Msg freq varies. Msg&data rates may apply. Reply STOP to opt out. Privacy/Terms: https://sefs-sms-compliance.pages.dev

Opt-out keywords:
STOP,STOPALL,UNSUBSCRIBE,CANCEL,END,QUIT

Opt-out message:
Southeast Flooring Solutions: You have successfully opted out. You will not receive any more messages from this number. Reply START to opt back in.

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
START

HELP

Mike Bierfreund 9315551212 wants 600 sqft metallic at 123 Main St follow up in 3 days

If information is missing, the parser replies with one question at a time. When all required details are available, it creates a New Lead in Supabase.
