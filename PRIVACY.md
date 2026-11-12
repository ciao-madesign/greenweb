# Privacy policy

Greenweb works entirely on your device.

**What it stores (locally, in the browser's extension storage)**
- For each day and each website domain: number of requests, bytes transferred (when the server declares them) and active time.
- For each day and domain, also: the number of requests that could not be attributed to a tab (background workers of a site you have open, such as service workers) and their declared size. Only counters, never what they contain, and only for sites open in a non-private tab.
- Your settings (region, language, device, metric, thresholds).
- In the browser's temporary memory (not on disk, cleared when the browser closes): the domain of the active tab and a timestamp, to keep counting active time while the browser puts the extension to sleep.
- Only if you turn it on for a service (off by default): the number of messages you send to that AI service per day, and the time covered by that counting. Never what you write or what it answers.
- Only if you turn on *Destination Control* (off by default): for each day, the domains your browser sends requests to and the IP addresses they answered from, with request counts. Never full web addresses, parameters, cookies or content. Identification (provider, network, country) uses a dataset bundled with the extension, on your device: no lookup service is contacted.
- Data older than your retention setting (7, 30 or 90 days; 90 by default) is deleted automatically.

**What it never collects**
Page content, full web addresses, search terms, AI prompts, cookies, passwords, account data or any personal information.

**Network and third parties**
The extension makes no network requests of its own, has no server, no analytics and no advertising, and shares nothing with anyone.

**Your control (Settings → Privacy and data)**
- *Pause tracking*: nothing is recorded while paused (also available from the dashboard).
- *Never track these sites*: sites you list are never recorded, and data already collected for them is deleted when you add them.
- *Keep data for* 7, 30 or 90 days; older data is deleted immediately when you shorten it.
- *Export my data (CSV)*: a file with exactly what is stored, nothing else.
- *Delete all data* removes everything immediately. Uninstalling the extension removes all stored data.
- Private windows are never tracked.

**Open source**
The code is public (MIT): https://github.com/ciao-madesign/greenweb

**Contact**
Open an issue in the repository.

_Last updated: 2026-11-10_
