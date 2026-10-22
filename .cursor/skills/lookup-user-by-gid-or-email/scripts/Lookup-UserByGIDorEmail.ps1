<#
.SYNOPSIS
    Look up a Siemens Energy AD user by email or GID.

.DESCRIPTION
    PowerShell equivalent of LookupUserByGIDorEmail.xlsm (v1.2).
    Queries ad101.siemens-energy.net Global Catalog on port 3268.

.PARAMETER Email
    User email address. Preferred when both Email and Gid are supplied.

.PARAMETER Gid
    Siemens GID or sAMAccountName.

.EXAMPLE
    .\Lookup-UserByGIDorEmail.ps1 -Email "jane.doe@siemens-energy.com"

.EXAMPLE
    .\Lookup-UserByGIDorEmail.ps1 -Gid "Z0047B4J"
#>
[CmdletBinding()]
param(
    [Parameter(ParameterSetName = 'Email')]
    [string]$Email,

    [Parameter(ParameterSetName = 'Gid')]
    [string]$Gid
)

$ErrorActionPreference = 'Stop'

if (-not $Email -and -not $Gid) {
    throw 'Provide -Email or -Gid.'
}

$ldapPath = 'LDAP://ad101.siemens-energy.net:3268/DC=ad101,DC=siemens-energy,DC=net'
$properties = @(
    'sAMAccountName', 'otherPager', 'c', 'manager',
    'siemens-costLocationUnit', 'siemens-costLocation', 'mobile',
    'physicalDeliveryOfficeName', 'msDS-PhoneticFirstName', 'sn',
    'title', 'department', 'siemens-gid', 'mail'
)

if ($Email) {
    $filter = "(mail=$Email)"
} else {
    $filter = "(|(sAMAccountName=$Gid)(siemens-gid=$Gid))"
}

$searcher = New-Object System.DirectoryServices.DirectorySearcher
$searcher.SearchRoot = New-Object System.DirectoryServices.DirectoryEntry($ldapPath)
$searcher.Filter = $filter
$searcher.SearchScope = [System.DirectoryServices.SearchScope]::Subtree
foreach ($prop in $properties) {
    [void]$searcher.PropertiesToLoad.Add($prop)
}

$result = $searcher.FindOne()
if (-not $result) {
    Write-Output ([pscustomobject]@{
        Status = 'NOT FOUND'
        Email  = $Email
        Gid    = $Gid
    })
    exit 1
}

$entry = $result.Properties
[pscustomobject]@{
    Status                   = 'FOUND'
    sAMAccountName           = $entry['samaccountname'][0]
    OrgCode                  = $entry['otherpager'][0]
    Country                  = $entry['c'][0]
    Manager                  = $entry['manager'][0]
    CostLocationUnit         = $entry['siemens-costlocationunit'][0]
    CostCenter               = $entry['siemens-costlocation'][0]
    Mobile                   = $entry['mobile'][0]
    Location                 = $entry['physicaldeliveryofficename'][0]
    FirstName                = $entry['msds-phoneticfirstname'][0]
    LastName                 = $entry['sn'][0]
    Title                    = $entry['title'][0]
    Department               = $entry['department'][0]
    Gid                      = $entry['siemens-gid'][0]
    Email                    = $entry['mail'][0]
}
