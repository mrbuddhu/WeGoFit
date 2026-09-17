import React, { useState } from "react";
import { View, Text, ScrollView, TouchableOpacity, Linking, TextInput, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import S from "../lib/styles";
import { ROSE, C } from "../lib/constants";
import { Card, PrimaryBtn, Row, Spacer } from "../components/shared";

// ─── LEGAL SCREENS ───────────────────────────────────────────────────────────

export function PolicySection({ section, theme, accentColor }) {
  const [expanded, setExpanded] = useState(false);
  const color = accentColor || ROSE;
  return (
    <View style={{ backgroundColor: theme.card, borderRadius: 16, marginBottom: 10,
      borderWidth: 1, borderColor: theme.border, overflow: "hidden" }}>
      <TouchableOpacity onPress={() => setExpanded(e => !e)} activeOpacity={0.7}
        style={{ flexDirection: "row", alignItems: "center", padding: 16, gap: 12 }}>
        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: color + "18",
          alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: color + "30" }}>
          <Text style={{ fontSize: 18 }}>{section.icon}</Text>
        </View>
        <Text style={{ flex: 1, fontSize: 15, fontWeight: "700", color: theme.text }}>{section.title}</Text>
        <Text style={{ fontSize: 20, color: color, transform: [{ rotate: expanded ? "90deg" : "0deg" }] }}>›</Text>
      </TouchableOpacity>
      {expanded && (
        <View style={{ paddingHorizontal: 16, paddingBottom: 16, borderTopWidth: 1, borderTopColor: theme.border }}>
          <Text style={{ fontSize: 13, color: theme.textSub, lineHeight: 22, marginTop: 12 }}>
            {section.content}
          </Text>
        </View>
      )}
    </View>
  );
}

export function PrivacyPolicyScreen({ onBack, theme }) {
  const sections = [
    { icon: "🛡️", title: "Introduction", content: `WeGoFit ("we", "our", or "us") is operated by Coach TinaBarks and is committed to protecting your personal information and your right to privacy.\n\nThis Privacy Policy explains how we collect, use, and protect your data when you use the WeGoFit mobile application.\n\nBy using WeGoFit, you agree to the collection and use of information in accordance with this policy.\n\nLast updated: May 2026\nEffective date: May 2026` },
    { icon: "📋", title: "Information We Collect", content: `We collect the following types of information:\n\nPERSONAL INFORMATION:\n- Full name and email address\n- Age, gender, height and weight\n- Fitness goals and activity level\n- Profile photos (optional)\n\nHEALTH & FITNESS DATA:\n- Daily calorie and macro intake\n- Food diary entries\n- Exercise sessions and GPS routes\n- Sleep duration and quality\n- Body weight measurements\n- Water intake records\n- Step count data\n\nDEVICE DATA:\n- Device type and operating system\n- GPS location (during workouts only)\n- Motion and fitness sensor data\n- App usage and interaction data\n\nCOMMUNICATION DATA:\n- Messages sent to Coach TinaBarks\n- Support tickets and enquiries` },
    { icon: "🎯", title: "How We Use Your Information", content: `We use your personal data to:\n\n- Provide personalised fitness coaching and nutrition recommendations\n- Calculate your BMR, TDEE and daily calorie targets using the Mifflin-St Jeor formula\n- Generate your weekly meal plans\n- Track your workout progress and verify session authenticity\n- Enable Coach TinaBarks to provide personal coaching and support\n- Send you relevant health tips and motivational messages\n- Improve the WeGoFit app and services\n- Process subscription payments\n- Respond to support enquiries\n- Comply with legal obligations\n\nWe do NOT use your data for:\n- Selling to third parties\n- Advertising or marketing by others\n- Any purpose without your consent` },
    { icon: "🔒", title: "Data Storage & Security", content: `YOUR DATA STAYS ON YOUR DEVICE:\nThe majority of your WeGoFit data is stored locally on your device using AsyncStorage. This means your food logs, workout history, sleep records and personal measurements remain on your phone.\n\nCOACH ACCESS:\nCoach TinaBarks can view your progress data through the WeGoFit Coach Dashboard to provide personalised coaching. This data is accessed securely.\n\nAI FOOD SEARCH:\nWhen you use the AI food search feature, your food queries are sent to OpenAI's API to retrieve nutritional information. Please review OpenAI's privacy policy at openai.com/privacy for details.\n\nSECURITY MEASURES:\n- All data transmission uses HTTPS encryption\n- Passwords are encoded before storage\n- We regularly review our security\n- Access to coaching data is restricted to authorised personnel\n\nDATA RETENTION:\nYour data is retained for as long as your WeGoFit account is active. Upon account deletion, all personal data is permanently removed from our systems within 30 days.` },
    { icon: "📍", title: "Location Data", content: `WeGoFit requests access to your device location ONLY during active GPS workout sessions.\n\nHOW WE USE LOCATION:\n- To track workout routes in real time\n- To calculate distance and speed\n- To verify workout authenticity\n- To display your route on the map\n\nHOW WE DO NOT USE LOCATION:\n- We do not track your location in the background\n- We do not share location data with third parties\n- Location is not used for advertising purposes\n\nYou can revoke location permissions at any time through your device Settings. Note that GPS tracking features will not work without location permission.` },
    { icon: "👨‍👩‍👧", title: "Children's Privacy", content: `WeGoFit is designed for users aged 16 years and older.\n\nWe do not knowingly collect personal information from children under 16. If you are a parent or guardian and believe your child has provided us with personal information, please contact us at:\nsupport@wegofit.app\n\nWe will take immediate steps to delete such information from our systems.` },
    { icon: "🤝", title: "Third Party Services", content: `GoFit uses the following third-party services:\n\nOPENAI (AI Food Search):\n- Purpose: Nutritional data lookup\n- Data shared: Food search queries\n- Their policy: openai.com/privacy\n\nEXPO / REACT NATIVE:\n- Purpose: App development platform\n- Data shared: Crash reports\n- Their policy: expo.dev/privacy\n\nPAYMENT PROCESSORS:\n- Purpose: Subscription billing\n- Data shared: Payment information\n- Note: We never store card details\n\nThese services have their own privacy policies and we encourage you to review them. We are not responsible for the privacy practices of third-party services.` },
    { icon: "⚖️", title: "Your Rights", content: `You have the following rights regarding your personal data:\n\nRIGHT TO ACCESS:\nRequest a copy of all personal data we hold about you.\n\nRIGHT TO CORRECTION:\nUpdate or correct inaccurate personal information at any time through Profile Settings.\n\nRIGHT TO DELETION:\nRequest deletion of your account and all associated data through Profile → Delete Account or by contacting us directly.\n\nRIGHT TO DATA PORTABILITY:\nExport your WeGoFit data through Profile → Export My Data.\n\nRIGHT TO WITHDRAW CONSENT:\nWithdraw consent for data processing at any time by deleting your account.\n\nTO EXERCISE YOUR RIGHTS:\nEmail: support@wegofit.app\nWe will respond within 30 days.` },
    { icon: "📧", title: "Contact Us", content: `For any privacy-related questions, concerns or requests:\n\nCoach TinaBarks\nWeGoFit Fitness App\nEmail: support@wegofit.app\n\nFor support enquiries please use the in-app Contact Support feature in Profile → Contact Support.\n\nWe are committed to resolving any privacy concerns promptly and transparently.` },
    { icon: "🔄", title: "Changes to This Policy", content: `We may update this Privacy Policy from time to time to reflect changes in our practices or for legal, operational or regulatory reasons.\n\nWhen we make significant changes we will notify you through:\n- An in-app notification\n- A message from Coach TinaBarks\n- Updated "Last updated" date above\n\nYour continued use of WeGoFit after changes become effective constitutes your acceptance of the revised policy.` },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <View style={{ backgroundColor: "#1A1A2E", padding: 20, paddingTop: 50 }}>
        <TouchableOpacity onPress={onBack} style={{ flexDirection: "row", alignItems: "center", marginBottom: 16, gap: 6 }}>
          <Text style={{ color: ROSE, fontSize: 16, fontWeight: "600" }}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={{ fontSize: 26, fontWeight: "800", color: "#FFFFFF", marginBottom: 4 }}>Privacy Policy 🛡️</Text>
        <Text style={{ fontSize: 13, color: "#FFFFFF60" }}>WeGoFit · Last updated May 2026</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
        <View style={{ backgroundColor: "rgba(16,185,129,0.1)", borderRadius: 16, padding: 16, marginBottom: 20,
          borderLeftWidth: 4, borderLeftColor: "#10B981", flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
          <Text style={{ fontSize: 24 }}>💚</Text>
          <Text style={{ flex: 1, fontSize: 13, color: "#10B981", lineHeight: 20 }}>
            Your privacy matters to us. WeGoFit stores most of your health data locally on your device — we believe your health data belongs to you.
          </Text>
        </View>
        {sections.map((section, i) => (
          <PolicySection key={i} section={section} theme={theme} accentColor="#10B981" />
        ))}
        <View style={{ alignItems: "center", marginTop: 20, paddingTop: 20, borderTopWidth: 1, borderTopColor: theme.border }}>
          <Text style={{ fontSize: 12, color: theme.textSub, textAlign: "center", lineHeight: 18 }}>
            © 2026 WeGoFit · Coach TinaBarks{"\n"}support@wegofit.app{"\n\n"}WeGoFit v1.0.0
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

export function TermsOfServiceScreen({ onBack, theme }) {
  const sections = [
    { icon: "📜", title: "Agreement to Terms", content: `These Terms of Service ("Terms") govern your use of the WeGoFit mobile application operated by Coach TinaBarks ("WeGoFit", "we", "us", or "our").\n\nBy downloading, installing or using WeGoFit you agree to be bound by these Terms. If you do not agree to these Terms please do not use WeGoFit.\n\nThese Terms apply to all users including free users, paying subscribers and Coach TinaBarks' direct clients.\n\nLast updated: May 2026\nEffective date: May 2026` },
    { icon: "📱", title: "Use of WeGoFit", content: `ELIGIBILITY:\nYou must be at least 16 years old to use WeGoFit. By using WeGoFit you confirm that you meet this age requirement.\n\nACCOUNT REGISTRATION:\n- You are responsible for maintaining the confidentiality of your account credentials\n- You are responsible for all activity under your account\n- You must provide accurate and complete information\n- One account per person only\n- You may not share your account with others\n\nPERMITTED USE:\nWeGoFit is for your personal, non-commercial fitness and nutrition tracking purposes only.\n\nPROHIBITED USE:\nYou may not:\n- Use WeGoFit for any unlawful purpose\n- Attempt to access other users' data\n- Reverse engineer or copy the app\n- Use WeGoFit to harass or harm others\n- Create false or misleading content\n- Attempt to circumvent subscription payments or security features` },
    { icon: "💳", title: "Subscriptions & Payments", content: `SUBSCRIPTION PLANS:\n\nMONTHLY PLAN — $20.00/month\n- Billed monthly\n- Cancel anytime\n- Access to all premium features\n\nANNUAL PLAN — $16.00/month\n- Billed $192.00 annually\n- Save $48 compared to monthly\n- Access to all premium features\n- Priority coach access\n\nFREE PLAN:\n- Limited access to basic features\n- Food and exercise logging\n- No coach chat access\n- No AI meal planning\n\nFREE TRIAL:\n- 7-day free trial available\n- Full premium access during trial\n- Cancel before trial ends to avoid charges\n- One free trial per user\n\nBILLING:\n- Payments processed securely\n- Subscriptions renew automatically\n- You will be notified before renewal\n- We do not store payment card details\n\nCANCELLATION:\n- Cancel anytime through your device's app store subscription settings\n- Cancellation takes effect at end of current billing period\n- No refunds for partial periods unless required by law\n\nREFUNDS:\n- Refund requests considered on a case-by-case basis\n- Contact: support@wegofit.app\n\nVIP ACCESS:\n- Certain accounts may receive complimentary premium access\n- VIP access is granted at our discretion and may be revoked` },
    { icon: "🏋️", title: "Health & Fitness Disclaimer", content: `IMPORTANT — PLEASE READ CAREFULLY:\n\nWeGoFit provides general fitness and nutrition information and tracking tools. WeGoFit is NOT a medical service and Coach TinaBarks is NOT a medical doctor.\n\nTHE INFORMATION IN WEGOFIT:\n- Is for general informational purposes only\n- Is not medical advice\n- Is not a substitute for professional medical consultation\n- Should not be used to diagnose or treat any medical condition\n\nBEFORE STARTING ANY FITNESS PROGRAMME:\n- Consult your doctor especially if you have any medical conditions\n- Inform your doctor of any medications you take\n- Stop exercising immediately if you experience pain, dizziness or discomfort\n- Seek immediate medical attention for any health emergency\n\nCALORIE AND NUTRITION TARGETS:\n- Targets are calculated using standard formulas (Mifflin-St Jeor)\n- Individual results may vary\n- Nutritional needs differ by person\n- These targets are guidelines only\n\nBY USING WEGOFIT YOU ACKNOWLEDGE:\nThat you are voluntarily participating in physical activity and assume all risks associated with such activity.` },
    { icon: "🤖", title: "AI Features", content: `WeGoFit uses artificial intelligence features powered by OpenAI to provide:\n\n- AI food search and nutritional data\n- AI weekly meal plan generation\n- AI coach assistant responses\n- Smart workout recommendations\n\nIMPORTANT ABOUT AI FEATURES:\n- AI responses are generated automatically and may not be perfectly accurate\n- AI meal plans are suggestions only and should be adapted to your individual needs\n- AI coach responses are not a substitute for Coach TinaBarks' personal coaching\n- Always verify nutritional information from trusted sources\n- AI features require an internet connection and an OpenAI API key\n\nACCURACY:\nWhile we strive for accuracy, WeGoFit and its AI features may occasionally provide incorrect nutritional or fitness information. We are not liable for decisions made based on AI-generated content.` },
    { icon: "🏆", title: "Community & Challenges", content: `WEGOFIT SQUAD COMMUNITY:\nBy participating in the WeGoFit community features you agree to:\n\n- Be respectful to all members\n- Not post offensive, harmful or misleading content\n- Not share other users' personal information without consent\n- Not spam or post promotional content\n\nCHALLENGES & LEADERBOARD:\n- Challenge results are based on data logged in WeGoFit\n- WeGoFit uses workout verification to ensure challenge integrity\n- We reserve the right to disqualify entries that appear fraudulent\n- Prizes and rewards are subject to availability and our discretion\n- We may modify or cancel challenges at any time\n\nBADGES & POINTS:\n- WeGoFit points and badges have no monetary value\n- They cannot be transferred or sold\n- We reserve the right to adjust the points system at any time` },
    { icon: "📊", title: "Intellectual Property", content: `WEGOFIT CONTENT:\nAll content in WeGoFit including but not limited to the app design, logo, workout videos, meal plans, text and graphics is owned by WeGoFit and Coach TinaBarks and is protected by intellectual property laws.\n\nYOU MAY NOT:\n- Copy, reproduce or distribute WeGoFit content without permission\n- Use the WeGoFit name or logo without written consent\n- Create derivative works based on WeGoFit content\n- Use WeGoFit content for commercial purposes\n\nYOUR CONTENT:\nContent you create and log in WeGoFit (food diary, workouts, progress) remains your personal property. WeGoFit uses this data only to provide our services to you.` },
    { icon: "⚠️", title: "Limitation of Liability", content: `TO THE MAXIMUM EXTENT PERMITTED BY LAW:\n\nWeGoFit and Coach TinaBarks shall not be liable for:\n\n- Any injury, illness or health complications arising from following WeGoFit recommendations\n- Loss of data due to technical issues\n- Inaccuracies in AI-generated nutritional information\n- Interruption or unavailability of the WeGoFit service\n- Actions of other WeGoFit users\n- Third-party service failures\n\nTOTAL LIABILITY:\nOur total liability to you for any claim shall not exceed the amount you paid to WeGoFit in the 3 months preceding the claim.\n\nINDEMNIFICATION:\nYou agree to indemnify WeGoFit and Coach TinaBarks against any claims, damages or expenses arising from your violation of these Terms.` },
    { icon: "🔚", title: "Termination", content: `WE MAY SUSPEND OR TERMINATE your account if you:\n\n- Violate these Terms of Service\n- Engage in fraudulent activity\n- Attempt to harm other users\n- Misuse the AI or coaching features\n- Provide false information\n- Fail to pay subscription fees\n\nYOU MAY TERMINATE your account at any time through:\nProfile → Account → Delete Account\n\nUpon termination:\n- Your access to WeGoFit will end\n- Your data will be deleted within 30 days as per our Privacy Policy\n- No refunds for unused subscription periods unless required by law\n\nSections of these Terms that by their nature should survive termination will continue to apply.` },
    { icon: "⚖️", title: "Governing Law", content: `These Terms are governed by and construed in accordance with the laws of Uganda and applicable East African community regulations.\n\nAny disputes arising from these Terms or your use of WeGoFit shall be resolved through:\n\n1. Direct communication with Coach TinaBarks first\n2. Mediation if direct resolution fails\n3. Competent courts of Uganda as a last resort\n\nCONTACT FOR DISPUTES:\nsupport@wegofit.app\n\nWe are committed to resolving any issues fairly and promptly.` },
    { icon: "📬", title: "Contact Us", content: `For questions about these Terms of Service:\n\nCoach TinaBarks\nWeGoFit Fitness App\nEmail: support@wegofit.app\n\nFor in-app support:\nProfile → Contact Support\n\nWe aim to respond to all enquiries within 24 hours on business days.\n\nFor urgent matters please mark your email subject as "URGENT — WeGoFit".` },
    { icon: "🔄", title: "Changes to Terms", content: `We reserve the right to modify these Terms at any time.\n\nWhen we make significant changes:\n- We will notify you in-app\n- We will update the effective date\n- Continued use after changes means you accept the new Terms\n\nIf you do not agree to changes you may close your account before the new Terms take effect.\n\nMinor changes (grammar, formatting) may be made without notification.` },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <View style={{ backgroundColor: "#1A1A2E", padding: 20, paddingTop: 50 }}>
        <TouchableOpacity onPress={onBack} style={{ flexDirection: "row", alignItems: "center", marginBottom: 16, gap: 6 }}>
          <Text style={{ color: ROSE, fontSize: 16, fontWeight: "600" }}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={{ fontSize: 26, fontWeight: "800", color: "#FFFFFF", marginBottom: 4 }}>Terms of Service ⚖️</Text>
        <Text style={{ fontSize: 13, color: "#FFFFFF60" }}>WeGoFit · Last updated May 2026</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
        <View style={{ backgroundColor: "rgba(255,107,53,0.08)", borderRadius: 16, padding: 16, marginBottom: 20,
          borderLeftWidth: 4, borderLeftColor: ROSE, flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
          <Text style={{ fontSize: 24 }}>📋</Text>
          <Text style={{ flex: 1, fontSize: 13, color: ROSE, lineHeight: 20 }}>
            Please read these Terms carefully before using WeGoFit. By using the app you agree to be bound by these Terms.
          </Text>
        </View>
        {sections.map((section, i) => (
          <PolicySection key={i} section={section} theme={theme} accentColor={i % 2 === 0 ? ROSE : "#1A1A2E"} />
        ))}
        <View style={{ alignItems: "center", marginTop: 20, paddingTop: 20, borderTopWidth: 1, borderTopColor: theme.border }}>
          <Text style={{ fontSize: 12, color: theme.textSub, textAlign: "center", lineHeight: 18 }}>
            © 2026 WeGoFit · Coach TinaBarks{"\n"}support@wegofit.app{"\n\n"}These terms were last reviewed by Coach TinaBarks in May 2026.{"\n\n"}WeGoFit v1.0.0
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}
