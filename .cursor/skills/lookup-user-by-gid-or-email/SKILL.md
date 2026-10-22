---
name: lookup-user-by-gid-or-email
description: >-
  Look up Siemens Energy employees in Active Directory by email or GID (sAMAccountName).
  Returns name, title, department, manager, org, location, and contact details.
  Use when the user asks to find or resolve a colleague by email, GID, Z-number, or
  siemens-energy.com address.
---

# Lookup User by GID or Email

## Run lookup

```powershell
& "$PWD\.cursor\skills\lookup-user-by-gid-or-email\scripts\Lookup-UserByGIDorEmail.ps1" -Email "user@siemens-energy.com" # pii-scan: ignore
& "$PWD\.cursor\skills\lookup-user-by-gid-or-email\scripts\Lookup-UserByGIDorEmail.ps1" -Gid "Z0047B4J"
```

Email is preferred when both email and GID are provided.

## LDAP details

- Server: `ad101.siemens-energy.net:3268` (Global Catalog)
- Base: `DC=ad101,DC=siemens-energy,DC=net`
- Email filter: `(mail={email})`
- GID filter: `(|(sAMAccountName={gid})(siemens-gid={gid}))`
- Auth: current Windows credentials

## Returned fields

| Output | LDAP attribute |
|--------|----------------|
| sAMAccountName | `sAMAccountName` |
| OrgCode | `otherPager` |
| Country | `c` |
| Manager | `manager` |
| CostLocationUnit | `siemens-costLocationUnit` |
| CostCenter | `siemens-costLocation` |
| Mobile | `mobile` |
| Location | `physicalDeliveryOfficeName` |
| FirstName | `msDS-PhoneticFirstName` |
| LastName | `sn` |
| Title | `title` |
| Department | `department` |
| Gid | `siemens-gid` |
| Email | `mail` |

Report **NOT FOUND** when the script exits with code 1.

## Troubleshooting

- **Timeout**: connect to corporate VPN and retry.
- **NOT FOUND**: verify spelling; try the other identifier (email vs GID).
- **Access denied**: user may lack AD read rights.
