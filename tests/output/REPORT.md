# 971 MMA — E2E Regression Report

Generated: 2026-06-30T20:30:16.783Z
Duration: 643.8s

**PASS 64 · FAIL 0 · SKIP 1** of 65


## mobile-app

### Member pass / issue

| Status | Scenario | Role | ms | Notes |
| --- | --- | --- | --- | --- |
| ✅ | member mints a signed v2 pass that expires within ~90s | member | 5004 |  |
| ✅ | coach scanner parses the member id out of a v2 pass | member | 479 |  |

### Member pass / coach class scan (mb-checkin)

| Status | Scenario | Role | ms | Notes |
| --- | --- | --- | --- | --- |
| ✅ | coach consumes a member pass once; replay is blocked; members cannot consume | member | 5444 |  |

### Auth / sign-in

| Status | Scenario | Role | ms | Notes |
| --- | --- | --- | --- | --- |
| ✅ | valid member credentials return a session | - | 4696 | {"status":200} |
| ✅ | wrong password is rejected as INVALID_CREDENTIALS (401) | - | 8473 |  |
| ✅ | unknown email does not leak account existence (same 401 + delay) | - | 639 |  |
| ✅ | missing email/password is a 400 BAD_REQUEST | - | 462 |  |
| ✅ | admin accounts cannot sign in through the mobile app (even with correct password) | - | 952 |  |

### Auth / profile bootstrap

| Status | Scenario | Role | ms | Notes |
| --- | --- | --- | --- | --- |
| ✅ | signed-in member has a profile with a valid role and active status | member | 1917 |  |
| ✅ | member can read their own profile via RLS but not others wholesale | member | 93 |  |

### Belt / progression

| Status | Scenario | Role | ms | Notes |
| --- | --- | --- | --- | --- |
| ✅ | recompute_belt_progress yields a rank-progress row for a member | member | 118 | {"progress":{"id":"e6acce7e-106a-483e-96d8-0b5318d1a48d","user_id":"6af3c9a0-562c-4cb8-85cb-bb8957ea8db6","discipline_id":"1853a27e-1584-4b8c-91b1-054b1be9db50" |
| ✅ | a member can read their own belt/rank progress | member | 101 |  |

### Communities / channel access

| Status | Scenario | Role | ms | Notes |
| --- | --- | --- | --- | --- |
| ✅ | list_community_channels returns a JSON array for a member | member | 111 | {"channelCount":0} |
| ✅ | a channel a member joins becomes visible in their channel listing | member | 7222 |  |

### Gate entry / display

| Status | Scenario | Role | ms | Notes |
| --- | --- | --- | --- | --- |
| ✅ | gate role issues a signed v2 entrance token | gate | 804 | {"locationId":"971mma-al-quoz"} |
| ✅ | a member pass presented at the gate scanner is rejected client-side | member | 880 |  |

### Gate entry / member self check-in

| Status | Scenario | Role | ms | Notes |
| --- | --- | --- | --- | --- |
| ✅ | member scans gate QR at the academy → gate_scan check-in + points | member | 18872 | {"pointsDelta":10,"checkInId":"c028daf2-2121-4839-b9dc-a1d7f3cb2c4e"} |
| ✅ | scanning from outside the geofence is rejected with distance | member | 3280 |  |
| ✅ | a second scan the same day is rejected as ALREADY_CHECKED_IN | member | 3170 |  |
| ✅ | a forged gate signature is rejected as TOKEN_INVALID | member | 515 |  |
| ✅ | missing GPS is rejected as BAD_REQUEST | member | 1537 |  |

### Guardians / child link request

| Status | Scenario | Role | ms | Notes |
| --- | --- | --- | --- | --- |
| ✅ | self-service child link is blocked — staff-managed only | - | 10561 |  |
| ✅ | a guardian link grants proxy authority only once approved | - | 24834 |  |

### Mindbody / linked state (mocked client id)

| Status | Scenario | Role | ms | Notes |
| --- | --- | --- | --- | --- |
| ✅ | a linked member is marked active and exposes the link metadata | admin | 32642 |  |
| ✅ | the same Mindbody client cannot be linked to two accounts | admin | 33922 |  |

### Mindbody / manual-link endpoint contract

| Status | Scenario | Role | ms | Notes |
| --- | --- | --- | --- | --- |
| ✅ | manual link requires staff and rejects an unknown client id | admin | 5817 |  |
| ✅ | mb-health reports Mindbody connectivity | admin | 844 | {"status":200,"body":{"ok":true,"siteId":"5730400","tokenAcquired":true,"autoLinkReady":true,"site":{"name":"971 MMA & Fitness Academy"}}} |

### Points / earning

| Status | Scenario | Role | ms | Notes |
| --- | --- | --- | --- | --- |
| ✅ | one gym check-in credits exactly +10 with a matching ledger entry | admin | 15188 |  |
| ✅ | two consecutive-day check-ins → balance 20 and current streak 2 | admin | 24147 |  |
| ✅ | double-credit is structurally prevented (unique ledger idempotency index) | admin | 8174 |  |

### Profile / notification preferences

| Status | Scenario | Role | ms | Notes |
| --- | --- | --- | --- | --- |
| ✅ | notification preferences round-trip (read → update → restore) | member | 1228 |  |

### Profile / support

| Status | Scenario | Role | ms | Notes |
| --- | --- | --- | --- | --- |
| ✅ | a member can file a support message | member | 2900 |  |

### Profile / account deletion (App Store requirement)

| Status | Scenario | Role | ms | Notes |
| --- | --- | --- | --- | --- |
| ✅ | a member can request account deletion → a pending request is recorded | - | 15951 | {"status":"pending"} |

### Redemption / happy path

| Status | Scenario | Role | ms | Notes |
| --- | --- | --- | --- | --- |
| ✅ | member redeems a reward → pending redemption, points deducted, ledger written | member | 45102 |  |
| ✅ | admin fulfils a pending redemption → status fulfilled (+audit) | member | 19114 |  |
| ✅ | admin cancels a pending redemption → points are refunded | member | 23214 |  |

### Redemption / guard rails

| Status | Scenario | Role | ms | Notes |
| --- | --- | --- | --- | --- |
| ✅ | redeeming with insufficient points is rejected | member | 5192 |  |
| ✅ | redeeming an out-of-stock reward is rejected | member | 20460 |  |
| ✅ | a tier-locked reward is rejected for a below-tier member | member | 22604 |  |

### Referrals / code

| Status | Scenario | Role | ms | Notes |
| --- | --- | --- | --- | --- |
| ✅ | a member has a stable referral code | member | 193 | {"code":"02D404"} |
| ✅ | a member can read their referral status payload | member | 107 |  |

### Referrals / application

| Status | Scenario | Role | ms | Notes |
| --- | --- | --- | --- | --- |
| ✅ | a new member applying a valid code is linked to the referrer | member | 10471 |  |
| ✅ | applying a non-existent code is rejected | - | 5181 |  |

### Roll call / session lifecycle

| Status | Scenario | Role | ms | Notes |
| --- | --- | --- | --- | --- |
| ✅ | coach starts a roll call, marks a scanned member present, and completes | admin | 30394 | {"classId":"a98cdbd6-86b4-4dbb-a93f-05bd9ea12f65","marked":"3eace07b-05f8-4217-b368-d17a19960af0","balance":10} |
| ✅ | a member marked absent does NOT earn a facility check-in on completion | admin | 67269 |  |

### Schedule / dashboard

| Status | Scenario | Role | ms | Notes |
| --- | --- | --- | --- | --- |
| ✅ | home dashboard returns a coherent payload with class info | member | 1048 | {"keys":["points","beltProgress","coachPreview","weekActivity","disciplineScore","rankEligibility","upcomingClasses"]} |

### Schedule / subscriptions

| Status | Scenario | Role | ms | Notes |
| --- | --- | --- | --- | --- |
| ✅ | a member can subscribe then unsubscribe from a class | member | 6801 |  |

## admin

### Admin / access control

| Status | Scenario | Role | ms | Notes |
| --- | --- | --- | --- | --- |
| ✅ | a member is rejected from every privileged RPC | member | 421 | {"guarded":["admin_search_users","admin_system_health","admin_reports_summary","admin_get_gate_settings"]} |
| ✅ | an admin is admitted to the same privileged RPCs | admin | 840 |  |

### Admin / account deletions

| Status | Scenario | Role | ms | Notes |
| --- | --- | --- | --- | --- |
| ✅ | admin advances a deletion request status without destroying the account | admin | 14292 |  |

### Admin / activations

| Status | Scenario | Role | ms | Notes |
| --- | --- | --- | --- | --- |
| ✅ | member requests activation → admin sees it → approval activates the account | admin | 16847 |  |

### Admin / broadcasts

| Status | Scenario | Role | ms | Notes |
| --- | --- | --- | --- | --- |
| ✅ | admin_send_broadcast persists an announcement | admin | 5326 |  |

### Admin / coaches

| Status | Scenario | Role | ms | Notes |
| --- | --- | --- | --- | --- |
| ✅ | admin_update_coach edits a coach bio (and restores) | admin | 4703 |  |

### Admin / community moderation

| Status | Scenario | Role | ms | Notes |
| --- | --- | --- | --- | --- |
| ⏭️ | admin_list_community_moderation is admin-callable and returns rows | admin | 95 | KNOWN BUG: admin_list_community_moderation has a broken UNION ORDER BY — see TEST-NOTES |
| ✅ | admin_list_community_channels is admin-callable | admin | 656 | {"ok":true} |

### Admin / content

| Status | Scenario | Role | ms | Notes |
| --- | --- | --- | --- | --- |
| ✅ | admin_update_content_entry toggles a reward active flag | admin | 4025 |  |

### Admin / gate exit PIN

| Status | Scenario | Role | ms | Notes |
| --- | --- | --- | --- | --- |
| ✅ | admin sets an exit PIN; validation accepts it and rejects wrong PINs | admin | 4261 |  |

### Admin / guardians (staff-created links)

| Status | Scenario | Role | ms | Notes |
| --- | --- | --- | --- | --- |
| ✅ | staff can create a family link directly via guardian-approve | admin | 14764 | {"status":"approved","child":"Staff Child"} |

### Admin / health & reports

| Status | Scenario | Role | ms | Notes |
| --- | --- | --- | --- | --- |
| ✅ | admin_system_health returns a structured payload | admin | 230 | {"keys":["lastVisitSyncAt","syncJobsPending","syncJobsFailed24h","pendingActivations","pendingRedemptions","pendingGuardianLinks","recentFailedSyncJobs","recent |
| ✅ | admin_reports_summary returns a structured payload | admin | 183 | {"keys":["topClasses","windowDays","pointsIssued","activeMembers","retentionRate","attendanceCount","uniqueAttendees","redemptionsCount","fulfilledRedemptions"] |

### Admin / redemptions

| Status | Scenario | Role | ms | Notes |
| --- | --- | --- | --- | --- |
| ✅ | refunding a fulfilled redemption restores the member points | member | 37375 |  |
| ✅ | fulfilling a non-existent redemption is rejected (NOT_FOUND) | admin | 116 |  |

### Admin / support

| Status | Scenario | Role | ms | Notes |
| --- | --- | --- | --- | --- |
| ✅ | admin resolves a member support message | admin | 13628 |  |

### Admin / users

| Status | Scenario | Role | ms | Notes |
| --- | --- | --- | --- | --- |
| ✅ | admin_search_users finds an account by name | admin | 14457 |  |
| ✅ | admin_set_user_role promotes a member to coach and back | admin | 12986 |  |