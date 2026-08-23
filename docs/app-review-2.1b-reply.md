# App Store Review reply — Submission e8a173ef (v1.0.1, build 22)

## Reply to paste into App Store Connect (Resolution Center)

Hello, and thank you for the review. Below are detailed answers to the
business-model questions (Guideline 2.1(b)), followed by a note on the change
we made for Guideline 2.5.4.

**About Taikan:** Taikan is a B2B SaaS platform for real-world fitness
businesses — gyms, studios, and independent coaches. Those businesses
("organizations") subscribe to Taikan to run their operations. This mobile app
is the **member-facing companion**: it is used by the existing clients of a
specific gym/studio/coach to manage their real-world membership (class
schedules and bookings, QR/GPS check-in at the physical gym, workout
programming assigned by their coach, announcements, and messaging). The app
contains no business-administration or B2B billing surfaces — gym owners manage
their business on the Taikan web dashboard, not in this app.

The app uses **no in-app purchase / StoreKit**, because the only paid offering
surfaced to members is access to a real-world fitness business's services
(physical gym access, in-person classes, and coaching). Per Guideline
3.1.3(e) / 3.1.5, services that take place in the real world are not required to
use in-app purchase. Members pay their gym directly through the gym's own
external payment processor (e.g. Stripe), on a provider-hosted web checkout page
opened outside the app — the gym is the merchant of record, and neither Taikan
nor Apple processes that payment within the app.

**1. Who are the users that will use the paid content, subscriptions, features,
and services in the app?**
The existing clients (members) of a specific gym, studio, or independent coach
that subscribes to Taikan. A member only sees the offerings of the one business
they belong to. They are real-world clients using the app as the companion to
their in-person membership.

**2. Where can users purchase the content, subscriptions, features, and
services that can be accessed in the app?**
Memberships are purchased from the member's own gym/studio — in person at the
gym, on the gym's own website, or via the gym's external, provider-hosted web
checkout (opened outside the app in a Safari web session). The payment is
processed by the gym's own payment processor. The app itself sells nothing and
collects no payment.

**3. What specific types of previously purchased content, subscriptions,
features, and services can a user access in the app?**
Once a member's gym has activated their membership (purchased in person, on the
gym's website, or via the external checkout), the member can access in the app:
their class schedule and bookings, QR/GPS check-in to the physical gym, the
workout programming and exercise demos assigned by their coach as part of that
membership, gym announcements, and messaging with their coach. These all
reflect the member's real-world membership at that gym.

**4. What paid content, subscriptions, or features are unlocked within your app
that do not use in-app purchase?**
Membership plans for the member's gym. Each plan represents that gym's
real-world offering — access to the physical facility, in-person classes, and
coaching. Some plans also include the coach's workout programming, which is
delivered as part of that real-world coaching relationship (not sold as a
standalone digital catalog by Taikan). Because these are services of a
real-world fitness business, paid through the gym's own external processor, they
are exempt from in-app purchase under Guideline 3.1.3(e) / 3.1.5.

**5. How do users obtain an account? Do users have to pay a fee to create an
account?**
Accounts are created by invitation only. The member's gym sends an invitation
email; the member opens that link, which is handled by the app, and sets a
password (via Clerk). There is no self-service sign-up inside the app and no
Sign in with Apple. A member who opens the app without an invitation is shown a
screen explaining they need one from their gym.

There is no fee to download or use the app and no fee to create an account. The
account exists only in the context of the member's own gym, which is what makes
this a companion app to that real-world business rather than a standalone
service. Demo credentials are supplied in App Review Information.

**6. Is there any paid content in the app and if so who pays for it? For
example, do users pay for opening an account or using certain features in the
app?**
Opening an account and using the app are free. The only paid item is the
member's gym membership, which the member pays to their gym (the merchant of
record) through the gym's external payment processor — not to Apple, and not as
a fee charged by the app. Taikan itself is paid by the gyms via a B2B SaaS
subscription billed entirely outside this consumer app.

**7. Are there enterprise services in your app?**
Taikan's enterprise/B2B service (the SaaS platform) is sold to fitness
businesses and is billed outside this app. This mobile app is purely the
consumer/member companion and contains no enterprise administration or B2B
billing functionality.

**8. Are the enterprise services in your app sold to single users, consumers,
or for family use?**
Within the app, memberships are sold by each gym to individual members for that
individual's own personal use — they are not family plans and not enterprise
seats. Taikan's platform subscription (the B2B/enterprise part) is sold to the
gym business and is handled entirely outside this app.

---

## Note for Guideline 2.5.4 (audio background mode)

The app does not have a persistent-audio feature. The `audio` entry in
`UIBackgroundModes` was added automatically by the Picture-in-Picture option of
our video component, which is only used for short exercise-demo clips and is not
needed. We have disabled Picture-in-Picture, which removes the `audio`
background mode entirely. This is fixed in the build now attached to this
submission, version 1.0.2 (25).
