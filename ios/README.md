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

## TestFlight

1. Open `Beanlo.xcodeproj` in Xcode → target *Beanlo* → *Signing &
   Capabilities* → pick your team (personal Apple Developer account works).
2. Product → Archive → Distribute App → TestFlight & App Store Connect.
   First time: create the app record in App Store Connect when prompted
   (bundle id `io.morta.beanlo`).
3. In App Store Connect → TestFlight → Internal Testing, add yourself and
   Victoria as testers; builds land on your phones via the TestFlight app.

Internal testing needs no App Review and updates arrive in minutes.
