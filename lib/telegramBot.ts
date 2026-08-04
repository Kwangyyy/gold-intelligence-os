/**
 * The bot's public handle.
 *
 * Not a secret — it is how people find the bot, and it appears in every link
 * handed out. Kept here rather than in the route because route modules may only
 * export handlers, and rather than in an environment variable because a value
 * that must match what BotFather shows is better read from one place in the
 * source than kept in sync by hand across environments.
 */
export const BOT_USERNAME = "gios_GoldIntelligence_alert_bot";

export const botUrl = () => `https://t.me/${BOT_USERNAME}`;
export const botDeepLink = (payload: string) => `https://t.me/${BOT_USERNAME}?start=${payload}`;
