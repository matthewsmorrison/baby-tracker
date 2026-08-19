/**
 * Same-tab signal that the feed timer's localStorage state changed. The
 * `storage` event only fires in OTHER tabs, so watchers (the floating timer
 * pill, the presence broadcaster) used to poll localStorage on an interval —
 * FeedForm now dispatches this instead, and watchers listen.
 */
export const FEED_TIMER_EVENT = "beanlo:feed-timer";

export const feedTimerKey = (babyId: string) => `hearth-feed-timer-${babyId}`;
