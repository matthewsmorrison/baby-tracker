# beanlo for iOS

Native SwiftUI app (iOS 26, Liquid Glass) talking to the same Supabase
project as the web app — same accounts, same data, live in both directions.
RLS authorizes every read/write, exactly like the web.

## Working on it

The Xcode project is generated from `project.yml`:

```sh
xcodegen            # after adding/removing files or changing settings
open Beanlo.xcodeproj
```

Sources live in `Beanlo/` — plain SwiftUI, one `Store` (auth + data),
no other dependencies beyond `supabase-swift`.

## Sign-in

- **Email link**: sends the normal beanlo sign-in email with
  `redirectTo: beanlo://auth-callback`; tapping the link on the phone
  deep-links into the app (`beanlo://` is allowlisted in Supabase auth).
- **Google**: `signInWithOAuth(.google)` in an in-app browser sheet,
  same redirect.

## Running on your own iPhone today (free personal team)

Plug the phone in, select it as the run destination, pick your personal
team on BOTH targets (Beanlo and BeanloWidgets) under *Signing &
Capabilities*, and hit Run. Free-team installs expire after 7 days
(re-run to refresh) and can't use push notifications.

## TestFlight (needs the paid Apple Developer Program)

TestFlight — and push notifications — require Apple Developer Program
membership ($99/yr): enroll at developer.apple.com/programs (approval
usually takes a day or two). Then:

1. Uncomment `aps-environment` in `project.yml` and rerun `xcodegen`
   to re-enable push.
2. Open `Beanlo.xcodeproj` → pick your (now paid) team on both targets.
3. Product → Archive → Distribute App → TestFlight & App Store Connect.
   First time: create the app record when prompted (bundle id `io.beanlo`).
4. App Store Connect → TestFlight → Internal Testing → add yourself and
   Victoria; builds land via the TestFlight app in minutes, no App Review.
