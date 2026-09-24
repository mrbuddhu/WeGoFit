const POINTS = {
  log_meal:           10,
  complete_workout:   50,
  hit_calorie_goal:   30,
  hit_water_goal:     20,
  log_sleep:          15,
  seven_day_streak:   100,
  complete_challenge: 200,
  lose_1kg:           150,
  share_achievement:  25,
};

const RARITY_CONFIG = {
  common:    { label: "COMMON",    color: "#888888", ringWidth: 3, glowRadius: 6,  cardBg: "#2D2D2D", border: "#444444",  iconBg: "#3D3D3D", rarityColor: "#888888", lockColor: "#666666", glow: "rgba(255,255,255,0.1)"  },
  uncommon:  { label: "UNCOMMON",  color: "#4CAF50", ringWidth: 3, glowRadius: 8,  cardBg: "#0D3D2E", border: "#1a6b4a",  iconBg: "#0F4D38", rarityColor: "#4CAF50", lockColor: "#4CAF50", glow: "rgba(76,175,80,0.3)"   },
  rare:      { label: "RARE",      color: "#4A90E2", ringWidth: 4, glowRadius: 12, cardBg: "#0D1B3E", border: "#1a3a7a",  iconBg: "#0F2050", rarityColor: "#4A90E2", lockColor: "#4A90E2", glow: "rgba(74,144,226,0.3)"  },
  epic:      { label: "EPIC",      color: "#B366FF", ringWidth: 4, glowRadius: 16, cardBg: "#2D0D3E", border: "#6B35B8",  iconBg: "#3D1050", rarityColor: "#B366FF", lockColor: "#B366FF", glow: "rgba(179,102,255,0.3)" },
  legendary: { label: "LEGENDARY", color: "#FFD700", ringWidth: 5, glowRadius: 20, cardBg: "#3D2800", border: "#B8860B",  iconBg: "#4D3300", rarityColor: "#FFD700", lockColor: "#FFD700", glow: "rgba(255,215,0,0.4)"   },
};

const BADGES = [
  { id:"first_step",           name:"First Step",           icon:"👶", category:"starter",   desc:"Log your very first meal in WeGoFit. The journey of a thousand miles begins with one bite.",                                                                          how:"Log your first meal",                                           points:10,   rarity:"common"    },
  { id:"show_up",              name:"Show Up",               icon:"🚪", category:"starter",   desc:"Complete WeGoFit onboarding and set your first fitness goal. Showing up is half the battle.",                                                                          how:"Complete onboarding",                                           points:10,   rarity:"common"    },
  { id:"gravity_fighter",      name:"Gravity Fighter",       icon:"⚖️", category:"starter",   desc:"Log your weight for the first time. The scale and you are now on speaking terms.",                                                                                     how:"Log your weight for the first time",                            points:15,   rarity:"common"    },
  { id:"clean_eater",          name:"Clean Eater",           icon:"🥗", category:"nutrition", desc:"Log all 4 meals in a single day — breakfast, lunch, dinner and snack. The full squad shows up.",                                                                       how:"Log all 4 meals in one day",                                    points:25,   rarity:"common"    },
  { id:"calorie_sniper",       name:"Target Tracker",        icon:"🎯", category:"nutrition", desc:"Stay within your daily calorie target. Precision is a skill and you have it down.",                                                                                    how:"Finish within your calorie target",                             points:30,   rarity:"uncommon"  },
  { id:"hydration_hero",       name:"Hydration Hero",        icon:"💧", category:"hydration", desc:"Hit your 2L daily water goal 3 days in a row. Your skin is glowing and your kidneys are throwing a party.",                                                            how:"Hit 2L water goal 3 days running",                              points:25,   rarity:"uncommon"  },
  { id:"off_the_couch",        name:"Off The Couch",         icon:"🛋️", category:"fitness",   desc:"Complete your first workout in WeGoFit. The couch had a good run. Pun intended.",                                                                                      how:"Complete your first workout",                                   points:20,   rarity:"common"    },
  { id:"sweat_equity",         name:"Sweat Equity",          icon:"💦", category:"fitness",   desc:"Complete 10 workouts total. You have officially sweated more than a nervous accountant.",                                                                               how:"Log 10 total workouts",                                         points:50,   rarity:"uncommon"  },
  { id:"three_day_wonder",     name:"3-Day Wonder",          icon:"✨", category:"streak",    desc:"Log your meals or workouts 3 days in a row. Habits are forming. Can you feel it?",                                                                                      how:"Log activity 3 days in a row",                                  points:20,   rarity:"common"    },
  { id:"week_warrior",         name:"Week Warrior",          icon:"🗡️", category:"streak",    desc:"Maintain a 7-day logging streak. Monday through Sunday — you showed up every single day like a champion.",                                                             how:"7-day consecutive logging streak",                              points:40,   rarity:"uncommon"  },
  { id:"fortnight_fighter",    name:"Fortnight Fighter",     icon:"⚔️", category:"streak",    desc:"14-day logging streak. At this point WeGoFit is basically part of your personality.",                                                                                   how:"14-day consecutive streak",                                     points:75,   rarity:"rare"      },
  { id:"monthly_monster",      name:"Monthly Monster",       icon:"👹", category:"streak",    desc:"30-day logging streak. You have transcended ordinary motivation. You are a WeGoFit legend.",                                                                            how:"30-day consecutive streak",                                     points:150,  rarity:"epic"      },
  { id:"one_kg_down",          name:"1KG Down",              icon:"🎯", category:"weight",    desc:"Lose your first kilogram since joining WeGoFit. That kg has left the building. Permanently.",                                                                           how:"Lose 1kg since joining WeGoFit",                                points:50,   rarity:"rare"      },
  { id:"five_kg_titan",        name:"5KG Champion",          icon:"🏆", category:"weight",    desc:"Lose 5kg since joining WeGoFit. You have removed the weight of a small dog from your body.",                                                                            how:"Lose 5kg since joining WeGoFit",                                points:150,  rarity:"epic"      },
  { id:"transformation_titan", name:"Transformation Titan", icon:"🦋", category:"legend",   desc:"Complete a 30-day challenge, lose 5kg AND maintain a 30-day streak. You are not the same person who started.",                                                          how:"30-day streak + 5kg lost + challenge complete",                 points:300,  rarity:"legendary" },
  { id:"tinabarks_choice",     name:"TinaBarks Choice",      icon:"👑", category:"legend",   desc:"Personally awarded by Coach TinaBarks for outstanding dedication, consistency or transformation. Not everyone gets this one.",                                           how:"Awarded personally by Coach TinaBarks",                         points:200,  rarity:"legendary" },
];

const BADGE_CATEGORIES = ["all","starter","nutrition","hydration","fitness","streak","weight","legend"];

const MILESTONE_LEVELS = [
  { min: 0,    max: 99,   level: "Beginner",  emoji: "🌱", tagline: "Just Starting",       perk: "Welcome badge on profile",                                                 color: "#888888" },
  { min: 100,  max: 299,  level: "Active",    emoji: "💪", tagline: "Building Habits",     perk: "Unlocks custom profile border",                                            color: "#4CAF50" },
  { min: 300,  max: 599,  level: "Committed", emoji: "🔥", tagline: "On The Journey",      perk: "Unlocks exclusive Squad feed flair",                                       color: "#FB923C" },
  { min: 600,  max: 899,  level: "Champion",  emoji: "🏆", tagline: "Transformation Mode", perk: "Featured on Squad leaderboard + special champion badge",                  color: "#4A90E2" },
  { min: 900,  max: 1170, level: "Elite",     emoji: "👑", tagline: "WeGoFit Legend",      perk: "Permanent Legend crown + personal shoutout from Coach TinaBarks",         color: "#FFD700" },
];

const MOCK_FEED = [
  { id:"f0",   userId:"coach", userName:"Coach TinaBarks", userInitials:"CT", isCoach:true, isPinned:true, type:"announcement", content:"Welcome to the WeGoFit Squad! 🎉 This is YOUR space to celebrate wins, share progress and motivate each other. Every step counts! Let's crush our goals together! 💪", emoji:"🌸", likes:47, likedBy:[], comments:12, postedAt: new Date(Date.now()-7200000).toISOString() },
  { id:"f1",   userId:"mock_sarah",  userName:"Sarah K.",  userInitials:"SK", type:"workout",     content:"Just completed my first 5K run! Feeling absolutely amazing!", emoji:"🏃", stats:{ distance:"5.2km", duration:"32:14", calories:312 }, likes:8,  likedBy:[], comments:3,  postedAt: new Date(Date.now()-7200000).toISOString()   },
  { id:"f2",   userId:"mock_john",   userName:"John D.",   userInitials:"JD", type:"badge",       content:"Just unlocked the \"Week Warrior\" badge! 7 days straight — no days off!", emoji:"🏆", stats:{ points:150 }, likes:12, likedBy:[], comments:5, postedAt: new Date(Date.now()-18000000).toISOString()  },
  { id:"f3",   userId:"mock_mary",   userName:"Mary L.",   userInitials:"ML", type:"meal",        content:"Crushed my meal plan today! Ugali + sukuma wiki + tilapia for lunch — healthy AND delicious!", emoji:"🥗", stats:{ calories:1780, target:1800 }, likes:6,  likedBy:[], comments:2, postedAt: new Date(Date.now()-86400000).toISOString() },
  { id:"f4",   userId:"mock_anna",   userName:"Anna B.",   userInitials:"AB", type:"streak",      content:"Day 5 of my logging streak! Consistency is key. Small steps every day 🔥", emoji:"🔥", stats:{ streak:5 }, likes:9,  likedBy:[], comments:1, postedAt: new Date(Date.now()-172800000).toISOString() },
  { id:"f5",   userId:"mock_mike",   userName:"Mike R.",   userInitials:"MR", type:"weight",      content:"Down 1.5kg this week following the WeGoFit meal plan! This actually works!", emoji:"⚖️", stats:{ lost:"1.5kg" }, likes:15, likedBy:[], comments:6, postedAt: new Date(Date.now()-259200000).toISOString() },
  { id:"f6",   userId:"mock_grace",  userName:"Grace N.",  userInitials:"GN", type:"achievement", content:"Hit my water goal 3 days in a row! Never knew hydration could feel this good 💧", emoji:"💧", stats:{ days:3 }, likes:7,  likedBy:[], comments:2, postedAt: new Date(Date.now()-345600000).toISOString() },
  { id:"f7",   userId:"mock_david",  userName:"David O.",  userInitials:"DO", type:"workout",     content:"Just burned 520 calories in one session! Coach TinaBarks workouts are no joke 💪", emoji:"🔥", stats:{ calories:520 }, likes:11, likedBy:[], comments:4, postedAt: new Date(Date.now()-432000000).toISOString() },
  { id:"f8",   userId:"mock_faith",  userName:"Faith M.",  userInitials:"FM", type:"meal",        content:"Made uji with milk and banana this morning — perfect high-protein breakfast!", emoji:"🌅", stats:{}, likes:5,  likedBy:[], comments:1, postedAt: new Date(Date.now()-518400000).toISOString() },
];

const PRESET_CHALLENGES = [
  { id:"ch001", title:"7-Day Clean Eating Challenge",      emoji:"🥗", type:"nutrition",   description:"Log all 4 meals every day for 7 consecutive days. Show TinaBarks you can eat clean for a full week!", durationDays:7,  goal:{ metric:"meals_logged",       target:28, unit:"meals" }, reward:"🏅 Clean Eater Badge + 200 points",                   prize:"Free 1-month subscription",                  participants:24, isActive:true },
  { id:"ch002", title:"5K Running Challenge",               emoji:"🏃", type:"workout",     description:"Complete a 5K GPS run this week. Track it live in WeGoFit to count!", durationDays:7,  goal:{ metric:"distance_km",         target:5,  unit:"km"    }, reward:"🏅 5K Club Badge + 200 points",                        prize:"WeGoFit water bottle 💧",                     participants:18, isActive:true },
  { id:"ch003", title:"Hydration Hero Challenge",           emoji:"💧", type:"water",       description:"Hit your 2L daily water goal for 7 days in a row. Hydration = fat loss!", durationDays:7,  goal:{ metric:"water_days",          target:7,  unit:"days"  }, reward:"💧 Fish Vibes Badge + 150 points",                    prize:"Shoutout from Coach TinaBarks 📣",            participants:31, isActive:true },
  { id:"ch004", title:"30-Day Transformation Challenge",    emoji:"⚖️", type:"weight_loss", description:"Lose at least 2kg in 30 days using WeGoFit meal plans and workouts.", durationDays:30, goal:{ metric:"weight_lost_kg",      target:2,  unit:"kg"    }, reward:"🦋 Transformation Titan Badge + 500 pts",             prize:"3-month free subscription 🎁",               participants:42, isActive:true },
  { id:"ch005", title:"Sleep Champion Challenge",           emoji:"😴", type:"sleep",       description:"Log 7+ hours of sleep for 5 out of 7 days this week.", durationDays:7,  goal:{ metric:"good_sleep_days",     target:5,  unit:"days"  }, reward:"👑 Sleep Champion Badge + 200 pts",                   prize:"Recovery tips PDF from TinaBarks",            participants:19, isActive:true },
  { id:"ch006", title:"East African Healthy Eating",        emoji:"🌍", type:"nutrition",   description:"Log 3 traditional East African meals from the WeGoFit African database this week.", durationDays:7,  goal:{ metric:"african_foods_logged", target:3, unit:"meals" }, reward:"🌍 East Africa Eats Badge + 150 pts",                 prize:"Featured in WeGoFit community feed 📸",       participants:37, isActive:true },
];

const CHALLENGE_TYPE_COLORS = {
  nutrition:   "#10B981",
  workout:     "#F43F8E",
  steps:       "#3B82F6",
  sleep:       "#7C3AED",
  water:       "#60A5FA",
  weight_loss: "#F59E0B",
};

const SLEEP_TIPS = [
  "Avoid screens 1 hour before bed — the blue light tricks your brain into thinking it's daytime.",
  "Keep your bedroom cool (18-22°C) for deeper sleep cycles.",
  "No caffeine after 2PM — it stays in your system for 6+ hours.",
  "Try a relaxing routine: warm shower, light stretching, or reading.",
  "Consistency is key — go to bed and wake up at the same time every day, even weekends.",
];

const SECURITY_QUESTIONS = [
  "What was the name of your first pet?",
  "What city were you born in?",
  "What is your mother's maiden name?",
  "What was the make of your first car?",
];

const ACHIEVEMENTS = [
  { id: "first_workout",   icon: "🏃", title: "First Workout",      desc: "Completed your first workout",       points: 50 },
  { id: "week_streak",     icon: "🔥", title: "7-Day Streak",       desc: "Logged activity 7 days in a row",     points: 100 },
  { id: "first_badge",     icon: "🏅", title: "Badge Earned",       desc: "Earned your first badge",             points: 25 },
  { id: "calorie_goal_7d", icon: "🎯", title: "Calorie Sharpshooter", desc: "Hit calorie target 7 days straight", points: 150 },
  { id: "water_goal_7d",   icon: "💧", title: "Hydrated Week",      desc: "Hit water goal 7 days in a row",      points: 100 },
  { id: "meal_logger_30d", icon: "📝", title: "Dedicated Logger",   desc: "Logged meals for 30 days",            points: 200 },
  { id: "5kg_lost",        icon: "⚖️", title: "5KG Down",           desc: "Lost 5kg since joining",              points: 300 },
  { id: "challenge_done",  icon: "🏆", title: "Challenge Crusher",  desc: "Completed a WeGoFit challenge",       points: 200 },
];

export {
  POINTS, RARITY_CONFIG, BADGES, BADGE_CATEGORIES, MILESTONE_LEVELS,
  MOCK_FEED, PRESET_CHALLENGES, CHALLENGE_TYPE_COLORS,
  SLEEP_TIPS, SECURITY_QUESTIONS, ACHIEVEMENTS,
};
