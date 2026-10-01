const MAX_BODY_BYTES = 32 * 1024;
const ASSET_BUNDLE = {"index.html":{"body":"<!doctype html>\n<html lang=\"en\">\n  <head>\n    <meta charset=\"UTF-8\" />\n    <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0, viewport-fit=cover\" />\n    <meta name=\"theme-color\" content=\"#08131f\" />\n    <meta name=\"description\" content=\"Legit is a privacy-aware map for local happenings and evidence trails.\" />\n    <title>Legit — local happenings on one map</title>\n    <link rel=\"preconnect\" href=\"https://fonts.googleapis.com\" />\n    <link rel=\"preconnect\" href=\"https://fonts.gstatic.com\" crossorigin />\n    <link href=\"https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=DM+Sans:wght@400;500;600;700&display=swap\" rel=\"stylesheet\" />\n    <link rel=\"stylesheet\" href=\"https://unpkg.com/leaflet@1.9.4/dist/leaflet.css\" integrity=\"sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=\" crossorigin=\"anonymous\" />\n    <link rel=\"stylesheet\" href=\"./styles.css\" />\n  </head>\n  <body>\n    <main id=\"app\" aria-label=\"Legit local happenings map\">\n      <a class=\"skip-link\" href=\"#map\">Skip to map</a>\n      <h1 class=\"sr-only\">Legit local happenings map</h1>\n      <div id=\"map\" tabindex=\"0\" aria-label=\"OpenStreetMap of aggregated local happenings\"></div>\n      <div class=\"map-ui\">\n        <header class=\"topbar\">\n          <button class=\"brand brand-trigger\" id=\"openAccount\" type=\"button\" aria-haspopup=\"dialog\" aria-controls=\"accountModal\" aria-label=\"Open account sign in\"><span class=\"brand-mark\">L</span><span>legit<span class=\"brand-dot\">.</span></span></button>\n          <span class=\"area-chip\"><i></i> Portland, ME · aggregated</span>\n          <div class=\"top-actions\"><button class=\"glass-button\" id=\"openAccessibility\" aria-haspopup=\"dialog\" aria-expanded=\"false\" aria-controls=\"accessibilityPanel\"><span aria-hidden=\"true\">Aa</span><span class=\"accessibility-label\"> Accessibility</span></button><button class=\"glass-button\" id=\"openFilters\">Filters <span id=\"filterCount\"></span></button><button class=\"post-button\" id=\"openComposer\">＋ Post</button></div>\n        </header>\n        <div class=\"map-key\" role=\"note\"><span id=\"signalCount\" aria-live=\"polite\">6 signals</span><span class=\"key-divider\"></span><span><i class=\"key-dot left\"></i>left</span><span><i class=\"key-dot mixed\"></i>mixed</span><span><i class=\"key-dot right\"></i>right</span><span class=\"size-key\"><i></i>impact</span><span class=\"instruction desktop-instruction\">left-click details · right-click actions</span><span class=\"instruction mobile-instruction\">tap details · hold actions</span><span class=\"data-status\" id=\"dataStatus\" role=\"status\">Loading live data…</span><span class=\"time-slider\"><span class=\"time-slider-head\"><span>TIME WINDOW</span><output id=\"timeValue\" for=\"timeRange\">Today</output></span><input id=\"timeRange\" type=\"range\" min=\"0\" max=\"5\" step=\"1\" value=\"0\" aria-label=\"Time range\" aria-valuetext=\"Today\" /><span class=\"time-labels\" aria-hidden=\"true\"><span>Today</span><span>Yesterday</span><span>Last week</span><span>Last month</span><span>Last year</span><span>All time</span></span></span></div>\n      </div>\n\n      <aside class=\"floating-panel filter-panel\" id=\"filterPanel\" hidden aria-label=\"Map filters\">\n        <div class=\"panel-head\"><div><span class=\"kicker\">MAP FILTERS</span><h2>Show me</h2></div><button class=\"close-button\" data-close=\"filterPanel\" aria-label=\"Close filters\">×</button></div>\n        <label>Legitimacy<select id=\"legitimacyFilter\"><option value=\"all\">Any signal</option><option value=\"early\">Early signal</option><option value=\"building\">Building</option><option value=\"legit\">Corroborated</option></select></label>\n        <label>Balance<select id=\"balanceFilter\"><option value=\"all\">Any angle</option><option value=\"left\">Left-leaning angle</option><option value=\"right\">Right-leaning angle</option><option value=\"agnostic\">Agnostic / mixed</option></select></label>\n        <label>Importance<select id=\"importanceFilter\"><option value=\"all\">Any impact</option><option value=\"low\">Low impact</option><option value=\"medium\">Medium impact</option><option value=\"high\">High impact</option></select></label>\n        <p class=\"privacy-line\">Color describes reported perspective, not truth. Marker size describes impact.</p>\n      </aside>\n\n      <aside class=\"floating-panel access-panel\" id=\"accessibilityPanel\" hidden aria-label=\"Accessibility settings\">\n        <div class=\"panel-head\"><div><span class=\"kicker\">ACCESSIBILITY</span><h2>Make it easier to use</h2></div><button class=\"close-button\" data-close=\"accessibilityPanel\" aria-label=\"Close accessibility settings\">×</button></div>\n        <label>Text size<select id=\"accessTextSize\"><option value=\"default\">Default</option><option value=\"large\">Large</option><option value=\"largest\">Largest</option></select></label>\n        <label class=\"toggle-row\"><input type=\"checkbox\" id=\"accessHighContrast\" /><span class=\"toggle-ui\"></span><span>High contrast</span></label>\n        <label class=\"toggle-row\"><input type=\"checkbox\" id=\"accessReducedMotion\" /><span class=\"toggle-ui\"></span><span>Reduce motion</span></label>\n        <label class=\"toggle-row\"><input type=\"checkbox\" id=\"accessMapLabels\" /><span class=\"toggle-ui\"></span><span>Show map labels</span></label>\n        <p class=\"privacy-line\">Settings stay on this device. Map labels make perspective readable without relying on color.</p>\n      </aside>\n\n      <aside class=\"floating-panel mini-card\" id=\"miniCard\" hidden aria-live=\"polite\">\n        <button class=\"close-button\" data-close=\"miniCard\" aria-label=\"Close event preview\">×</button>\n        <div class=\"event-kicker\"><span id=\"miniStatusDot\"></span><span id=\"miniStatus\"></span><span id=\"miniTime\"></span></div>\n        <h2 id=\"miniTitle\"></h2><p id=\"miniBody\"></p>\n        <div class=\"mini-meta\"><span id=\"miniLocation\"></span><span id=\"miniScore\"></span></div><div class=\"mini-meter\"><span id=\"miniMeter\"></span></div>\n        <div class=\"mini-actions\"><button class=\"subtle-button\" id=\"miniAdd\">＋ Add</button><button class=\"subtle-button\" id=\"miniUseful\">↑ Useful</button><button class=\"dark-button\" id=\"miniFull\">View full</button></div>\n      </aside>\n\n      <section class=\"modal-backdrop\" id=\"accountModal\" hidden><article class=\"modal account-modal\" role=\"dialog\" aria-modal=\"true\" aria-labelledby=\"accountTitle\"><button class=\"close-button\" data-close=\"accountModal\" aria-label=\"Close account dialog\">×</button><div class=\"kicker\">LEGIT PROFILE</div><h2 id=\"accountTitle\">Sign up or sign in</h2><p class=\"modal-copy\">Keep exploring anonymously. Sign in when you want to save signals, earn Legit points, or manage profile data.</p><div class=\"account-actions\"><a class=\"dark-button account-link\" href=\"/signin-with-chatgpt?return_to=%2F%3Fauth%3D1%23map\" target=\"_top\">Sign up / sign in</a><button class=\"subtle-button\" data-close=\"accountModal\">Continue anonymously</button></div><div class=\"profile-controls\" id=\"profileControls\"><div class=\"section-head\"><span class=\"kicker\">DATA CONTROLS</span><span id=\"profileAuthStatus\">Sign in to manage</span></div><p class=\"privacy-line\">Your profile tools are designed for access, control, and deletion. Anonymous contributions stay aggregated and are not linked to this profile.</p><label class=\"toggle-row\"><input type=\"checkbox\" id=\"profileAggregateOnly\" checked disabled /><span class=\"toggle-ui\"></span><span>Store only aggregated map data <small>always on</small></span></label><label class=\"toggle-row\"><input type=\"checkbox\" id=\"profileOptOutSharing\" checked disabled /><span class=\"toggle-ui\"></span><span>Do not sell or share my data <small>always on</small></span></label><label class=\"toggle-row\"><input type=\"checkbox\" id=\"profileLimitSensitive\" checked disabled /><span class=\"toggle-ui\"></span><span>Limit sensitive data use</span></label><label class=\"correction-field\">Request a correction<textarea id=\"correctionDetails\" rows=\"2\" maxlength=\"1000\" placeholder=\"Describe what should be corrected\"></textarea></label><div class=\"account-actions privacy-actions\"><button class=\"subtle-button\" id=\"requestCorrection\" disabled>Submit correction request</button><button class=\"subtle-button\" id=\"exportMyData\" disabled>Download my data</button><button class=\"danger-button\" id=\"deleteAllData\" disabled>Delete all data</button></div><p class=\"privacy-line\" id=\"profileDataSummary\" aria-live=\"polite\">Sign in to view profile-linked data.</p></div><p class=\"privacy-line\">Delete all data removes records linked to this profile. Anonymous aggregated signals and anonymous abuse-prevention records are not linked back to you.</p></article></section>\n\n      <div class=\"context-menu\" id=\"actionMenu\" hidden role=\"menu\" aria-label=\"Event actions\"><div class=\"context-title\" id=\"actionTitle\">Event actions</div><button data-action=\"add\" role=\"menuitem\">＋ Add to desk</button><button data-action=\"full\" role=\"menuitem\">↗ View full details</button><button data-action=\"useful\" role=\"menuitem\">↑ Upvote useful evidence</button><button data-action=\"report\" role=\"menuitem\">⚑ Report an issue</button></div>\n\n      <section class=\"modal-backdrop\" id=\"detailModal\" hidden><article class=\"modal detail-modal\" role=\"dialog\" aria-modal=\"true\" aria-labelledby=\"detailTitle\"><button class=\"close-button\" data-close=\"detailModal\" aria-label=\"Close details\">×</button><div class=\"event-kicker\"><span id=\"detailStatusDot\"></span><span id=\"detailStatus\"></span><span id=\"detailTime\"></span></div><h2 id=\"detailTitle\"></h2><p class=\"detail-body\" id=\"detailBody\"></p><div class=\"detail-grid\"><div><span>PUBLIC AREA</span><strong id=\"detailLocation\"></strong></div><div><span>PERSPECTIVE</span><strong id=\"detailBalance\"></strong></div><div><span>IMPORTANCE</span><strong id=\"detailImportance\"></strong></div><div><span>LEGITIMACY</span><strong id=\"detailScore\"></strong></div></div><div class=\"detail-section\"><span class=\"kicker\">PRIMARY CLAIM</span><p id=\"detailClaim\"></p><small id=\"detailClaimAttribution\"></small><p class=\"privacy-line\" id=\"detailBasis\"></p></div><div class=\"detail-section\"><div class=\"section-head\"><span class=\"kicker\">EVIDENCE TRAIL</span><span id=\"detailSources\"></span></div><div id=\"sourceList\"></div></div><div class=\"detail-section\" id=\"correctionHistorySection\" hidden><span class=\"kicker\">CORRECTION HISTORY</span><div id=\"correctionHistory\"></div></div><div class=\"detail-actions\"><button class=\"subtle-button\" id=\"detailAdd\">＋ Add to desk</button><button class=\"dark-button\" id=\"detailUseful\">↑ Upvote useful evidence</button><button class=\"subtle-button\" id=\"detailReport\">⚑ Report / correct</button></div><p class=\"privacy-line\">Anonymous reports stay aggregated by default. Perspective is descriptive; legitimacy reflects evidence alignment, not popularity.</p></article></section>\n\n      <section class=\"modal-backdrop\" id=\"reportModal\" hidden><article class=\"modal report-modal\" role=\"dialog\" aria-modal=\"true\" aria-labelledby=\"reportTitle\"><button class=\"close-button\" data-close=\"reportModal\" aria-label=\"Close report form\">×</button><div class=\"kicker\">COMMUNITY REVIEW</div><h2 id=\"reportTitle\">Report or correct this signal</h2><p class=\"modal-copy\">Suggest a correction, question a source, or flag a safety/privacy concern. Your report enters review; it does not change the public signal immediately.</p><form id=\"reportForm\"><label>Review request<select id=\"reportReason\"><option value=\"correction\">Suggest a correction</option><option value=\"appeal\">Appeal a legitimacy or moderation decision</option><option value=\"source_issue\">Question a source</option><option value=\"privacy\">Report a privacy concern</option><option value=\"safety\">Report a safety concern</option></select></label><label>Details<textarea id=\"reportDetails\" rows=\"4\" maxlength=\"500\" required placeholder=\"What should reviewers check?\"></textarea></label><div class=\"privacy-note\">Reports are stored with the same privacy controls as other submissions. Identities remain private by default.</div><div class=\"modal-actions\"><button type=\"button\" class=\"subtle-button\" data-close=\"reportModal\">Cancel</button><button type=\"submit\" class=\"post-button\">Send for review</button></div></form></article></section>\n\n      <section class=\"modal-backdrop\" id=\"composerModal\" hidden><article class=\"modal composer-modal\" role=\"dialog\" aria-modal=\"true\" aria-labelledby=\"composerTitle\"><button class=\"close-button\" data-close=\"composerModal\" aria-label=\"Close post form\">×</button><div class=\"kicker\">NEW LOCAL SIGNAL</div><h2 id=\"composerTitle\">What are you seeing?</h2><p class=\"modal-copy\">Post early. The map keeps uncertainty visible while people check the evidence.</p><form id=\"composerForm\"><label>Short description<input required id=\"postTitle\" maxlength=\"90\" placeholder=\"e.g. Power is out on Congress Street\" /></label><label>What happened?<textarea required id=\"postBody\" rows=\"3\" maxlength=\"420\" placeholder=\"What did you see, and what is still uncertain?\"></textarea></label><label>Public area<input required id=\"postLocation\" placeholder=\"Neighborhood, street, or landmark\" /></label><div class=\"form-row\"><label>Topic<select id=\"postTopic\"><option>Community</option><option>Public safety</option><option>Local government</option><option>Weather &amp; transit</option><option>Other</option></select></label><label>Map precision<select id=\"locationPrivacy\"><option value=\"aggregate\">Aggregated area · always on</option></select></label></div><label class=\"toggle-row\"><input type=\"checkbox\" id=\"anonymousToggle\" checked /><span class=\"toggle-ui\"></span><span>Post anonymously <small>recommended</small></span></label><label id=\"identityField\" hidden>Display name<input id=\"postIdentity\" maxlength=\"40\" placeholder=\"Name or group\" /></label><label>First source <span class=\"optional\">optional</span><input id=\"postSource\" type=\"url\" placeholder=\"https://… or describe what you saw\" /></label><div class=\"privacy-note\">◌ New signals are filtered and stored with neighborhood-level location only. Exact pins are never stored.</div><div class=\"modal-actions\"><button type=\"button\" class=\"subtle-button\" data-close=\"composerModal\">Cancel</button><button type=\"submit\" class=\"post-button\">Post signal</button></div></form></article></section>\n      <div class=\"toast\" id=\"toast\" role=\"status\" aria-live=\"polite\"></div>\n    </main>\n    <script src=\"https://unpkg.com/leaflet@1.9.4/dist/leaflet.js\" integrity=\"sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=\" crossorigin=\"anonymous\"></script><script src=\"./app.js\"></script>\n  </body>\n</html>\n","type":"text/html; charset=utf-8"},"styles.css":{"body":":root{--ink:#08131f;--paper:#f4f1e9;--white:#fffdf7;--line:rgba(8,19,31,.14);--muted:#687581;--amber:#f6b74b;--amber-dark:#bd761e;--blue:#4388f4;--red:#e4565a;--purple:#9b76d5;--green:#35c978;--shadow:0 16px 44px rgba(3,13,22,.22)}*{box-sizing:border-box}html,body,#app{width:100%;height:100%;margin:0;overflow:hidden}body{background:var(--paper);color:var(--ink);font-family:\"DM Sans\",sans-serif}button,input,textarea,select{font:inherit}button{border:0;cursor:pointer}#map{position:absolute;inset:0;background:#cad5ce}.leaflet-container{font-family:\"DM Sans\",sans-serif;background:#d8ded8;z-index:1}.leaflet-control-zoom a{color:#536565!important;background:rgba(255,253,247,.94)!important;border-color:var(--line)!important}.leaflet-control-attribution{font-size:9px!important;background:rgba(255,253,247,.82)!important;color:#536565!important}.leaflet-control-attribution a{color:#3e7770!important}.map-ui{position:absolute;z-index:5;inset:0;pointer-events:none}.topbar,.map-key{pointer-events:auto}.topbar{position:absolute;top:16px;left:16px;right:16px;display:flex;align-items:center;gap:16px;max-width:calc(100% - 32px);padding:10px 12px;background:rgba(8,19,31,.92);color:var(--white);border:1px solid rgba(255,255,255,.12);border-radius:9px;box-shadow:var(--shadow)}.brand{display:flex;align-items:center;gap:8px;color:var(--white);text-decoration:none;font-size:21px;font-weight:700;letter-spacing:-.06em}.brand-mark{display:grid;place-items:center;width:28px;height:28px;border-radius:8px;background:var(--amber);color:var(--ink);font-size:17px}.brand-dot{color:var(--amber)}.area-chip{display:flex;align-items:center;gap:7px;color:#b8c9ce;font:500 10px \"DM Mono\",monospace;text-transform:uppercase;letter-spacing:.04em}.area-chip i{width:7px;height:7px;border-radius:50%;background:#76d4d2;box-shadow:0 0 0 4px rgba(118,212,210,.14)}.top-actions{display:flex;gap:8px;margin-left:auto}.glass-button,.post-button,.subtle-button,.dark-button{border-radius:6px;padding:9px 12px;font-size:12px;font-weight:700}.glass-button{background:rgba(255,255,255,.1);color:var(--white);border:1px solid rgba(255,255,255,.18)}.glass-button:hover{background:rgba(255,255,255,.18)}.post-button{background:var(--amber);color:var(--ink)}.post-button:hover{background:#ffd073}.map-key{position:absolute;top:78px;left:16px;display:flex;align-items:center;gap:10px;padding:7px 10px;background:rgba(255,253,247,.9);border:1px solid var(--line);border-radius:5px;color:#536468;box-shadow:0 7px 18px rgba(8,19,31,.12);font:500 10px \"DM Mono\",monospace;text-transform:uppercase;letter-spacing:.03em}.key-divider{width:1px;height:14px;background:var(--line)}.key-dot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:3px}.key-dot.left{background:var(--blue)}.key-dot.mixed{background:var(--purple)}.key-dot.right{background:var(--red)}.size-key{display:flex;align-items:center;gap:4px}.size-key i{display:inline-block;width:13px;height:13px;border-radius:50%;background:#63737a;box-shadow:0 0 0 2px rgba(99,115,122,.15)}.instruction{color:#889496;text-transform:none;letter-spacing:0}.floating-panel{position:absolute;z-index:8;top:116px;left:16px;background:rgba(255,253,247,.97);border:1px solid var(--line);border-radius:8px;box-shadow:var(--shadow)}.filter-panel{width:235px;padding:18px}.panel-head{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:17px}.kicker{display:block;color:#8b9691;font:500 10px \"DM Mono\",monospace;letter-spacing:.09em;text-transform:uppercase}.panel-head h2,.mini-card h2,.modal h2{margin:4px 0 0;letter-spacing:-.05em;line-height:1.05}.panel-head h2{font-size:22px}.close-button{position:absolute;top:9px;right:11px;background:transparent;color:#778383;font-size:23px;line-height:1}.filter-panel label,.composer-modal label{display:block;color:#56666b;font-size:11px;font-weight:700;margin:0 0 12px}.filter-panel select,.composer-modal input,.composer-modal textarea,.composer-modal select{width:100%;display:block;margin-top:6px;padding:9px 10px;border:1px solid #d2d8d1;border-radius:4px;background:#fffefa;color:var(--ink);font-size:13px;font-weight:400}.filter-panel select:focus,.composer-modal input:focus,.composer-modal textarea:focus,.composer-modal select:focus{outline:0;border-color:var(--amber-dark);box-shadow:0 0 0 3px rgba(246,183,75,.18)}.privacy-line{margin:12px 0 0;color:#7a8782;font-size:10px;line-height:1.4}.mini-card{left:16px;bottom:25px;width:min(380px,calc(100vw - 32px));padding:19px 18px 15px}.event-kicker{display:flex;align-items:center;gap:7px;color:#76827f;font:500 9px \"DM Mono\",monospace;text-transform:uppercase;letter-spacing:.05em;padding-right:22px}.event-kicker span:last-child{margin-left:auto;color:#a1aaa5}.event-kicker>span:first-child{width:7px;height:7px;border-radius:50%;background:var(--purple)}.mini-card h2{font-size:22px;margin-top:11px;max-width:330px}.mini-card p{color:#657279;font-size:13px;line-height:1.45;margin:8px 0 12px}.mini-meta{display:flex;justify-content:space-between;gap:10px;color:#73817f;font:500 10px \"DM Mono\",monospace;text-transform:uppercase}.mini-meter{height:5px;background:#e1e3dd;border-radius:4px;overflow:hidden;margin:9px 0 13px}.mini-meter span{display:block;height:100%;background:linear-gradient(90deg,var(--blue),var(--green))}.mini-actions,.detail-actions,.modal-actions{display:flex;justify-content:flex-end;gap:7px}.subtle-button{background:#eef1ed;color:#4b6667}.subtle-button:hover{background:#e0ebe6}.dark-button{background:var(--ink);color:var(--white)}.dark-button:hover{background:#173247}.context-menu{position:absolute;z-index:15;width:225px;background:rgba(255,253,247,.98);border:1px solid var(--line);border-radius:7px;box-shadow:var(--shadow);padding:6px}.context-title{padding:8px 10px 7px;color:#8b9691;font:500 9px \"DM Mono\",monospace;text-transform:uppercase;letter-spacing:.08em;border-bottom:1px solid var(--line);margin-bottom:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.context-menu button{display:block;width:100%;padding:10px;text-align:left;background:transparent;color:#35484e;font-size:12px;border-radius:4px}.context-menu button:hover{background:#eef1ed}.map-marker{display:flex;align-items:center;gap:5px;background:transparent;filter:drop-shadow(0 3px 4px rgba(8,19,31,.24));transition:transform .15s}.map-marker:hover{transform:scale(1.1)}.marker-dot{display:block;width:calc(12px + var(--impact) * 6px);height:calc(12px + var(--impact) * 6px);border-radius:50%;background:var(--balance-color);border:3px solid rgba(255,253,247,.95);box-shadow:0 0 0 2px color-mix(in srgb,var(--balance-color) 28%,transparent)}.marker-count{background:rgba(255,253,247,.94);border-radius:3px;padding:3px 5px;color:#304144;font:500 9px \"DM Mono\",monospace}.marker-label{position:absolute;top:calc(100% + 5px);left:50%;transform:translateX(-50%);background:rgba(8,19,31,.84);color:var(--white);padding:4px 5px;font:500 9px \"DM Mono\",monospace;white-space:nowrap;opacity:0;pointer-events:none}.map-marker:hover .marker-label{opacity:1}.modal-backdrop{position:absolute;z-index:20;inset:0;display:grid;place-items:center;padding:16px;background:rgba(4,12,18,.53);backdrop-filter:blur(3px)}.modal-backdrop[hidden],.floating-panel[hidden],.context-menu[hidden]{display:none}.modal{position:relative;width:min(100%,600px);max-height:calc(100vh - 32px);overflow:auto;background:var(--white);border-radius:8px;padding:25px 28px;box-shadow:0 30px 80px rgba(0,0,0,.3)}.detail-modal h2,.composer-modal h2{font-size:29px;margin:9px 0 11px}.detail-body,.modal-copy{color:#657279;font-size:14px;line-height:1.5;margin:0 0 17px}.detail-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:12px 0 19px}.detail-grid div{background:#eef1ed;padding:10px}.detail-grid span{display:block;color:#8b9691;font:500 8px \"DM Mono\",monospace;letter-spacing:.05em}.detail-grid strong{display:block;font-size:12px;margin-top:4px;line-height:1.25}.detail-section{border-top:1px solid var(--line);padding:15px 0}.detail-section p{font-size:14px;line-height:1.45;margin:7px 0 4px}.detail-section small{color:#7d8985;font-size:10px}.section-head{display:flex;justify-content:space-between}.evidence-row{display:flex;gap:9px;border-top:1px solid var(--line);padding:10px 0}.evidence-row:first-child{margin-top:8px}.evidence-avatar{display:grid;place-items:center;flex:none;width:26px;height:26px;border-radius:50%;background:#dcebe7;color:#387d79;font:500 9px \"DM Mono\",monospace}.evidence-copy strong{font-size:12px}.evidence-copy p{color:#6e7a7f;font-size:11px;line-height:1.35;margin:2px 0}.evidence-copy small{color:#9aa29e;font-size:9px}.detail-actions{border-top:1px solid var(--line);padding-top:14px;margin-top:2px}.composer-modal{width:min(100%,550px)}.composer-modal form{margin-top:18px}.composer-modal textarea{resize:vertical}.form-row{display:grid;grid-template-columns:1fr 1fr;gap:10px}.toggle-row{display:flex!important;align-items:center;gap:8px;margin:3px 0 14px!important;font-size:12px!important}.toggle-row input{position:absolute;opacity:0;width:1px;height:1px}.toggle-ui{width:29px;height:17px;border-radius:20px;background:#d4d8d2;position:relative}.toggle-ui:after{content:\"\";position:absolute;width:13px;height:13px;left:2px;top:2px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.15);transition:transform .15s}.toggle-row input:checked+.toggle-ui{background:#2e9a8b}.toggle-row input:checked+.toggle-ui:after{transform:translateX(12px)}.toggle-row small,.optional{color:#8d9995;font:500 9px \"DM Mono\",monospace;text-transform:uppercase}.privacy-note{background:#eef1ed;padding:10px;color:#6f7d79;font-size:10px;line-height:1.4}.modal-actions{margin-top:15px}.toast{position:absolute;z-index:30;bottom:23px;left:50%;transform:translate(-50%,15px);background:var(--ink);color:var(--white);padding:11px 15px;border-radius:5px;font-size:12px;opacity:0;pointer-events:none;transition:opacity .2s,transform .2s;box-shadow:0 8px 20px rgba(0,0,0,.2)}.toast.show{opacity:1;transform:translate(-50%,0)}@media (max-width:700px){.topbar{top:10px;left:10px;right:10px;max-width:calc(100% - 20px);gap:9px;padding:8px}.area-chip{display:none}.map-key{top:63px;left:10px;right:10px;max-width:calc(100% - 20px);overflow:hidden;white-space:nowrap}.instruction{display:none}.floating-panel{top:104px;left:10px}.mini-card{left:10px;bottom:14px;width:calc(100vw - 20px)}.mini-card h2{font-size:20px}.detail-grid{grid-template-columns:1fr 1fr}.modal{max-height:calc(100vh - 24px);padding:22px 18px}.form-row{display:block}.top-actions{gap:5px}.glass-button,.post-button{padding:8px 9px;font-size:11px}}\n.mobile-instruction{display:none}.map-marker{touch-action:none;-webkit-user-select:none;user-select:none}\n@media (max-width:700px){.desktop-instruction{display:none}.mobile-instruction{display:inline;color:#687581}}\n.map-key{right:16px;width:calc(100% - 32px);min-width:0;white-space:nowrap}.time-slider{margin-left:auto;flex:1 1 300px;min-width:240px;max-width:360px;padding-left:10px;border-left:1px solid var(--line);color:#536468}.time-slider-head{display:flex;justify-content:space-between;align-items:center;gap:12px}.time-slider-head span:first-child{color:#8b9691;font-size:9px}.time-slider-head output{color:var(--ink);font-weight:700}.time-slider input{display:block;width:100%;min-width:0;accent-color:var(--amber-dark);margin:3px 0 0}.time-labels{display:flex;justify-content:space-between;color:#8a9697;font-size:8px;text-transform:none;letter-spacing:0}.time-labels>span{min-width:0;text-align:center}@media (max-width:1080px){.map-key{flex-wrap:wrap;white-space:normal;gap:7px 9px}.time-slider{order:10;flex:1 1 100%;min-width:0;max-width:none;margin-left:0;border-left:0;border-top:1px solid var(--line);padding:6px 0 0}}@media (max-width:700px){.map-key{top:63px;left:10px;right:10px;width:auto;max-width:calc(100% - 20px);overflow:hidden}.time-labels{font-size:7px}}\n.brand-trigger{padding:0;background:transparent}.brand-trigger:focus-visible{outline:2px solid var(--amber);outline-offset:4px}.account-modal{width:min(100%,430px)}.account-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.account-link{display:inline-flex;align-items:center;text-decoration:none}\n.skip-link{position:absolute;z-index:50;left:10px;top:8px;transform:translateY(-150%);padding:10px 12px;background:#fff;color:#08131f;border:2px solid #08131f;border-radius:4px;font-weight:700;text-decoration:none}.skip-link:focus{transform:translateY(0)}.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}.access-panel{top:116px;right:16px;left:auto;width:280px;padding:18px;z-index:9}.access-panel select{width:100%;display:block;margin-top:6px;padding:9px 10px;border:1px solid #d2d8d1;border-radius:4px;background:#fffefa;color:var(--ink);font-size:13px}.access-panel label{display:block;color:#56666b;font-size:11px;font-weight:700;margin:0 0 12px}.accessibility-label{white-space:nowrap}.brand-trigger:focus-visible,:where(button,a,input,select,textarea):focus-visible{outline:3px solid #ffbf47;outline-offset:3px}#app[data-text-size=\"large\"] :where(button,input,select,textarea,label,.map-key,.floating-panel,.modal,.kicker,.event-kicker,.mini-meta,.privacy-line,.marker-count,.marker-label,.time-labels,.time-slider-head){font-size:calc(100% + 2px)!important}#app[data-text-size=\"large\"] :where(h1,h2,h3,.brand){font-size:calc(100% + 2px)!important}#app[data-text-size=\"largest\"] :where(button,input,select,textarea,label,.map-key,.floating-panel,.modal,.kicker,.event-kicker,.mini-meta,.privacy-line,.marker-count,.marker-label,.time-labels,.time-slider-head){font-size:calc(100% + 4px)!important}#app[data-text-size=\"largest\"] :where(h1,h2,h3,.brand){font-size:calc(100% + 4px)!important}#app[data-high-contrast=\"true\"]{--paper:#fff;--white:#fff;--ink:#000;--line:#000;--muted:#111;--amber:#ffbf00;--amber-dark:#704600;--blue:#005fcc;--red:#b00020;--purple:#6a1b9a;--green:#006b36}#app[data-high-contrast=\"true\"] .topbar{background:#000;color:#fff;border-color:#fff}#app[data-high-contrast=\"true\"] .map-key,#app[data-high-contrast=\"true\"] .floating-panel{border:2px solid #000;box-shadow:0 0 0 2px #fff}#app[data-high-contrast=\"true\"] .instruction,#app[data-high-contrast=\"true\"] .privacy-line{color:#1f1f1f}#app[data-show-map-labels=\"true\"] .marker-label{opacity:1}#app[data-reduced-motion=\"true\"] *,#app[data-reduced-motion=\"true\"] *::before,#app[data-reduced-motion=\"true\"] *::after{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important;scroll-behavior:auto!important}@media (prefers-reduced-motion:reduce){*,*::before,*::after{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important;scroll-behavior:auto!important}}@media (max-width:700px){.access-panel{top:104px;left:10px;right:10px;width:auto}.accessibility-label{display:none}}\n.profile-controls{margin-top:18px;padding-top:16px;border-top:1px solid var(--line)}.profile-controls .section-head{margin-bottom:10px}.profile-controls .section-head>span:last-child{color:var(--muted);font-size:10px;text-transform:none;letter-spacing:0}.profile-controls .toggle-row{margin:10px 0}.privacy-actions{margin-top:14px}.danger-button{display:inline-flex;align-items:center;justify-content:center;border:1px solid #b83b3b;background:#fff3f1;color:#8f2424;border-radius:4px;padding:10px 12px;font:inherit;font-size:11px;font-weight:800;cursor:pointer}.danger-button:hover{background:#ffe4e0}.danger-button:disabled,.subtle-button:disabled{opacity:.5;cursor:not-allowed}\n.map-marker{cursor:pointer}.data-status{color:#4f6b6f;text-transform:none;letter-spacing:0}.data-status[data-state=\"loading\"]{color:#8b6a2a}.data-status[data-state=\"stale\"]{color:#9a3f42}.history-row{border-top:1px solid var(--line);padding:9px 0}.history-row:first-child{margin-top:7px}.history-row strong{font-size:12px}.history-row p{margin:3px 0;color:#66747a;font-size:12px;line-height:1.35}.history-row small{color:#8c9894;font-size:10px}.report-modal{width:min(100%,520px)}.report-modal form{margin-top:18px}.report-modal textarea{width:100%;display:block;box-sizing:border-box;margin-top:6px;padding:9px 10px;border:1px solid #d2d8d1;border-radius:4px;background:#fffefa;color:var(--ink);font:inherit;font-size:13px;resize:vertical}.report-modal select{width:100%;display:block;margin-top:6px;padding:9px 10px;border:1px solid #d2d8d1;border-radius:4px;background:#fffefa;color:var(--ink);font-size:13px}.report-modal label{display:block;color:#56666b;font-size:11px;font-weight:700;margin:0 0 12px}.map-key,.data-status,.time-labels{font-size:11px}.map-key .instruction{font-size:11px}.time-labels{font-size:10px}.marker-count{font-size:10px}.kicker{font-size:11px}\n.map-marker.pressing .marker-dot{transform:scale(1.16);box-shadow:0 0 0 4px color-mix(in srgb,var(--balance-color) 34%,transparent),0 0 18px color-mix(in srgb,var(--balance-color) 48%,transparent)}\n.correction-field{display:block;margin:12px 0 0;color:#56666b;font-size:11px;font-weight:700}.correction-field textarea{display:block;width:100%;box-sizing:border-box;margin-top:6px;padding:9px 10px;border:1px solid #d2d8d1;border-radius:4px;background:#fffefa;color:var(--ink);font:inherit;font-size:13px;resize:vertical}\n.map-key{padding:4px 8px;gap:7px;line-height:1.15}.key-divider{height:12px}.time-slider{padding-left:8px}.time-slider-head{line-height:1.1}@media (max-width:1080px){.time-slider{padding-top:4px}}@media (max-width:700px){.map-key{padding:3px 7px;gap:5px}.time-slider{padding-top:3px}.time-labels{line-height:1}}\n","type":"text/css; charset=utf-8"},"app.js":{"body":"const happenings = [\n  {id:1,title:\"Road closed near the bridge — anyone know why?\",body:\"Several people are reporting a full closure at the west side of the bridge. A photo shows cones, but the reason is still unclear.\",location:\"Casco Bay Bridge · West End\",topic:\"Public safety\",status:\"Needs checking\",time:\"12 min ago\",ageMinutes:12,balance:\"agnostic\",score:42,impact:4,sourceCount:3,checkers:8,reports:12,publicLat:43.6505,publicLng:-70.2782,nearby:true},\n  {id:2,title:\"Community fridge restocked after the storm\",body:\"The fridge on Congress is open and stocked again. Neighbors are asking for shelf-stable food and batteries.\",location:\"Congress St · Parkside\",topic:\"Community\",status:\"Building consensus\",time:\"24 min ago\",ageMinutes:24,balance:\"agnostic\",score:76,impact:3,sourceCount:7,checkers:19,reports:7,publicLat:43.6576,publicLng:-70.2676,nearby:true},\n  {id:3,title:\"City council packet includes a late zoning change\",body:\"A late addition appears in tonight’s meeting packet. Looking for someone who can compare it with the previous version.\",location:\"City Hall · Downtown\",topic:\"Local government\",status:\"Needs checking\",time:\"38 min ago\",ageMinutes:38,balance:\"left\",score:35,impact:3,sourceCount:2,checkers:5,reports:4,publicLat:43.6592,publicLng:-70.2553,nearby:false},\n  {id:4,title:\"Power flickering across East Bayside\",body:\"Reports are coming in from multiple blocks. CMP outage map has not updated yet; add a street or source if you can confirm.\",location:\"East Bayside\",topic:\"Weather & transit\",status:\"Building consensus\",time:\"51 min ago\",ageMinutes:51,balance:\"agnostic\",score:68,impact:5,sourceCount:9,checkers:24,reports:18,publicLat:43.6611,publicLng:-70.2454,nearby:true},\n  {id:5,title:\"Free rides offered for tonight’s school event\",body:\"A neighbor is coordinating rides for families who need a way home after the event. Details are in the source thread.\",location:\"East End Community School\",topic:\"Community\",status:\"Corroborated\",time:\"1 hr ago\",ageMinutes:60,balance:\"left\",score:91,impact:4,sourceCount:11,checkers:31,reports:13,publicLat:43.6754,publicLng:-70.2414,nearby:false},\n  {id:6,title:\"Question: is the farmers market moving this weekend?\",body:\"A sign at the usual lot suggests a change, but no official notice has surfaced yet.\",location:\"Deering Oaks\",topic:\"Community\",status:\"Unverified\",time:\"1 hr ago\",ageMinutes:60,balance:\"right\",score:18,impact:2,sourceCount:1,checkers:3,reports:3,publicLat:43.6750,publicLng:-70.2760,nearby:false}\n];\nconst claimSeeds = {1:{text:\"The west approach to the bridge was closed around 8:05 AM.\",attribution:\"Claim assembled from three local reports.\"},2:{text:\"The Congress Street community fridge is open and restocked after the storm.\",attribution:\"Claim combines neighborhood observations and a community update.\"},3:{text:\"Tonight’s city council packet contains a late zoning change.\",attribution:\"Claim awaits comparison with the prior public packet.\"},4:{text:\"Power interruptions are affecting multiple blocks in East Bayside.\",attribution:\"Independent resident reports; utility confirmation is pending.\"},5:{text:\"A free-ride network is operating for families leaving tonight’s school event.\",attribution:\"Supported by organizer, school notice, and participant accounts.\"},6:{text:\"The farmers market may move from its usual location this weekend.\",attribution:\"Observed sign; organizer confirmation is missing.\"}};\nconst evidenceSeeds = {1:[{id:\"e1\",initials:\"JM\",title:\"Jamie M. · firsthand\",excerpt:\"Saw the cones and a police detail at 8:05.\",provenance:\"Submitted 12 min ago\"},{id:\"e2\",initials:\"PD\",title:\"Portland traffic advisory\",excerpt:\"A city traffic-feed link was added; the reason is still pending.\",provenance:\"Public record\"}],2:[{id:\"e4\",initials:\"CF\",title:\"Community fridge coordinator\",excerpt:\"Restock list and opening hours posted to the neighborhood group.\",provenance:\"Community update\"}],3:[{id:\"e5\",initials:\"CH\",title:\"City council packet\",excerpt:\"The current packet contains a section missing from the earlier download.\",provenance:\"Public record\"}],4:[{id:\"e6\",initials:\"EB\",title:\"East Bayside residents\",excerpt:\"Several blocks describe repeated flickering and short outages.\",provenance:\"Independent reports\"}],5:[{id:\"e7\",initials:\"ER\",title:\"Event ride coordinator\",excerpt:\"Public signup list and pickup instructions are available.\",provenance:\"Organizer notice\"}],6:[{id:\"e8\",initials:\"DR\",title:\"Deering Oaks visitor\",excerpt:\"A photographed sign appears to suggest the market may be moving.\",provenance:\"Observed sign\"}]};\nconst balanceProfiles = {1:\"Mixed firsthand accounts; no consistent ideological framing.\",2:\"Practical, non-partisan community framing.\",3:\"The signal carries a left-leaning policy frame; that does not validate the claim.\",4:\"Independent resident reports without a consistent partisan frame.\",5:\"Organizer and participant accounts use a left-leaning service frame.\",6:\"A single observed sign is not enough to assign a stable perspective.\"};\nhappenings.forEach(item => { item.claim=claimSeeds[item.id]; item.evidence=evidenceSeeds[item.id] || []; item.balanceBasis=balanceProfiles[item.id]; item.saved=false; });\n\nconst toast = document.getElementById(\"toast\");\nconst miniCard = document.getElementById(\"miniCard\");\nconst actionMenu = document.getElementById(\"actionMenu\");\nlet map;\nlet selectedHappening = null;\nlet mapMarkers = [];\nlet postCounter = 0;\nlet publicLoadController = null;\nlet publicLoadTimer = null;\nconst refineFilters = {time:\"today\",legitimacy:\"all\",balance:\"all\",importance:\"all\"};\nconst userState = {points:128};\nconst accessibilityKey = \"legit-accessibility\";\nconst accessibilityState = {textSize:\"default\",highContrast:false,reducedMotion:false,mapLabels:false};\nconst deskStorageKey = \"legit-desk\";\nconst deskState = {server:false,keys:new Set()};\nlet lastFocusedElement = null;\n\nfunction saveAccessibility(){ try{ localStorage.setItem(accessibilityKey,JSON.stringify(accessibilityState)); }catch{} }\nfunction loadAccessibility(){ try{ const saved=JSON.parse(localStorage.getItem(accessibilityKey)||\"{}\"); if([\"default\",\"large\",\"largest\"].includes(saved.textSize)) accessibilityState.textSize=saved.textSize; [\"highContrast\",\"reducedMotion\",\"mapLabels\"].forEach(key => { if(typeof saved[key] === \"boolean\") accessibilityState[key]=saved[key]; }); }catch{} }\nfunction applyAccessibility(){ const app=document.getElementById(\"app\"); app.dataset.textSize=accessibilityState.textSize; app.dataset.highContrast=String(accessibilityState.highContrast); app.dataset.reducedMotion=String(accessibilityState.reducedMotion); app.dataset.showMapLabels=String(accessibilityState.mapLabels); document.getElementById(\"accessTextSize\").value=accessibilityState.textSize; document.getElementById(\"accessHighContrast\").checked=accessibilityState.highContrast; document.getElementById(\"accessReducedMotion\").checked=accessibilityState.reducedMotion; document.getElementById(\"accessMapLabels\").checked=accessibilityState.mapLabels; }\n\nfunction escapeHtml(value){ return String(value ?? \"\").replace(/[&<>\"']/g,char => ({\"&\":\"&amp;\",\"<\":\"&lt;\",\">\":\"&gt;\",\"\\\"\":\"&quot;\",\"'\":\"&#39;\"}[char])); }\nfunction balanceColor(balance){ return balance === \"left\" ? \"#4388f4\" : balance === \"right\" ? \"#e4565a\" : \"#9b76d5\"; }\nfunction balanceLabel(balance){ return balance === \"left\" ? \"Left angle\" : balance === \"right\" ? \"Right angle\" : \"Agnostic / mixed\"; }\nfunction statusColor(status){ return status === \"Corroborated\" ? \"#35c978\" : status === \"Building consensus\" ? \"#f6b74b\" : status === \"Needs checking\" ? \"#ef7c69\" : \"#9b76d5\"; }\nfunction legitColor(score){ const t=Math.max(0,Math.min(100,score))/100; return `rgb(${Math.round(67-12*t)},${Math.round(136+65*t)},${Math.round(244-124*t)})`; }\nfunction locationText(item){ return `${item.location} · aggregated`; }\nfunction matchesFilters(item){\n  const age=item.ageMinutes;\n  if(refineFilters.time === \"today\" && age > 1440) return false;\n  if(refineFilters.time === \"yesterday\" && (age <= 1440 || age > 2880)) return false;\n  if(refineFilters.time === \"week\" && age > 10080) return false;\n  if(refineFilters.time === \"month\" && age > 43200) return false;\n  if(refineFilters.time === \"year\" && age > 525600) return false;\n  if(refineFilters.legitimacy === \"early\" && item.score >= 40) return false;\n  if(refineFilters.legitimacy === \"building\" && (item.score < 40 || item.score >= 80)) return false;\n  if(refineFilters.legitimacy === \"legit\" && item.score < 80) return false;\n  if(refineFilters.balance !== \"all\" && item.balance !== refineFilters.balance) return false;\n  if(refineFilters.importance === \"low\" && item.impact > 2) return false;\n  if(refineFilters.importance === \"medium\" && (item.impact < 3 || item.impact > 4)) return false;\n  if(refineFilters.importance === \"high\" && item.impact < 5) return false;\n  return true;\n}\nfunction visibleHappenings(){ return happenings.filter(matchesFilters); }\nfunction publicStatus(score){ return score >= 80 ? \"Corroborated\" : score >= 40 ? \"Building consensus\" : \"Needs checking\"; }\nfunction setDataStatus(message,state=\"live\"){ const status=document.getElementById(\"dataStatus\"); if(status){ status.textContent=message; status.dataset.state=state; } }\nfunction relativeTime(iso){\n  const age=Math.max(0,Math.round((Date.now()-new Date(iso).getTime())/60000));\n  if(age < 1) return \"just now\";\n  if(age < 60) return `${age} min ago`;\n  const hours=Math.round(age/60);\n  if(hours < 24) return `${hours} hr${hours === 1 ? \"\" : \"s\"} ago`;\n  const days=Math.round(hours/24);\n  return `${days} day${days === 1 ? \"\" : \"s\"} ago`;\n}\nfunction mapServerHappening(item){\n  return {id:item.id,serverId:item.id,title:item.title,body:item.body,location:item.location,topic:item.topic,status:publicStatus(item.legitimacyScore),time:relativeTime(item.createdAt),ageMinutes:Math.max(0,Math.round((Date.now()-new Date(item.createdAt).getTime())/60000)),balance:item.balance || \"agnostic\",score:item.legitimacyScore || 0,impact:item.impact || 1,reports:item.reports || 1,publicLat:item.publicLat,publicLng:item.publicLng,claim:{text:item.body,attribution:`Aggregated from ${item.reports || 1} approved local report${item.reports === 1 ? \"\" : \"s\"}.`},evidence:item.evidence || [],corrections:item.corrections || [],balanceBasis:\"Perspective is calculated from the reported frames in the aggregated signal.\",legitimacyBasis:item.legitimacyBasis || \"Legitimacy reflects evidence alignment, not popularity.\",saved:deskState.keys.has(item.id)};\n}\nasync function loadPublicHappenings(){\n  setDataStatus(\"Refreshing live map…\",\"loading\");\n  publicLoadController?.abort();\n  const controller = new AbortController();\n  publicLoadController = controller;\n  try{\n    const response=await fetch(`/api/happenings?time=${encodeURIComponent(refineFilters.time)}`,{headers:{accept:\"application/json\"},signal:controller.signal});\n    if(!response.ok){ setDataStatus(\"Using last known map data\",\"stale\"); return; }\n    const data=await response.json();\n    const serverItems=(data.happenings || []).map(mapServerHappening);\n    const serverIds=new Set(serverItems.map(item => item.serverId));\n    for(let index=happenings.length-1; index>=0; index -= 1){ if(happenings[index].serverId && serverIds.has(happenings[index].serverId)) happenings.splice(index,1); }\n    happenings.push(...serverItems);\n    applyDeskState();\n    renderMarkers();\n    setDataStatus(serverItems.length ? \"Live · updated just now\" : \"Live · demo signals\", \"live\");\n  }catch(error){ if(error.name !== \"AbortError\") setDataStatus(\"Using last known map data\",\"stale\"); }\n  finally{ if(publicLoadController === controller) publicLoadController = null; }\n}\nfunction markerElement(item){\n  const el=document.createElement(\"div\"); el.className=\"map-marker\"; el.setAttribute(\"aria-hidden\",\"true\"); el.style.setProperty(\"--balance-color\",balanceColor(item.balance)); el.style.setProperty(\"--impact\",item.impact);\n  el.innerHTML=`<span class=\"marker-dot\"></span><span class=\"marker-count\">${item.reports}</span><span class=\"marker-label\">${balanceLabel(item.balance)} · ${item.score}% legit</span>`;\n  return el;\n}\nfunction bindMarkerPress(marker,item,pressState){\n  const node=marker.getElement();\n  if(!node) return;\n  node.setAttribute(\"role\",\"button\");\n  node.setAttribute(\"tabindex\",\"0\");\n  node.setAttribute(\"aria-label\",`${item.title}; ${balanceLabel(item.balance)}; ${item.score}% legitimacy; importance ${item.impact} of 5; press Enter for details or Shift+F10 for actions`);\n  let timer=null;\n  let startX=0;\n  let startY=0;\n  const cancel=() => { if(timer){ window.clearTimeout(timer); timer=null; } node.classList.remove(\"pressing\"); };\n  const finish=event => {\n    cancel();\n    if(pressState.held){\n      event.preventDefault();\n      event.stopPropagation();\n      pressState.suppressUntil=Date.now()+1200;\n      pressState.held=false;\n    }\n  };\n  node.addEventListener(\"pointerdown\",event => {\n    if(event.button !== 0 || pressState.pointerId != null) return;\n    pressState.pointerId=event.pointerId;\n    startX=event.clientX;\n    startY=event.clientY;\n    cancel();\n    node.classList.add(\"pressing\");\n    timer=window.setTimeout(() => {\n      timer=null;\n      node.classList.remove(\"pressing\");\n      pressState.held=true;\n      openActions(item,startX,startY);\n    },450);\n  });\n  node.addEventListener(\"pointermove\",event => {\n    if(event.pointerId !== pressState.pointerId) return;\n    if(Math.hypot(event.clientX-startX,event.clientY-startY)>10) cancel();\n  });\n  node.addEventListener(\"pointerup\",event => {\n    if(event.pointerId !== pressState.pointerId) return;\n    finish(event);\n    pressState.pointerId=null;\n  });\n  node.addEventListener(\"pointercancel\",event => {\n    if(event.pointerId !== pressState.pointerId) return;\n    cancel();\n    pressState.pointerId=null;\n    pressState.held=false;\n  });\n  node.addEventListener(\"contextmenu\",event => {\n    event.preventDefault();\n    event.stopPropagation();\n    cancel();\n    pressState.pointerId=null;\n    pressState.held=false;\n    pressState.suppressUntil=Date.now()+1200;\n    openActions(item,event.clientX,event.clientY);\n  });\n  node.addEventListener(\"keydown\",event => {\n    if(event.key === \"Enter\" || event.key === \" \"){\n      event.preventDefault();\n      openMini(item);\n    }else if(event.key === \"ContextMenu\" || (event.shiftKey && event.key === \"F10\")){\n      event.preventDefault();\n      const rect=node.getBoundingClientRect();\n      openActions(item,rect.left,rect.bottom,true);\n    }\n  });\n}\nfunction renderMarkers(){\n  if(!map) return;\n  mapMarkers.forEach(marker => marker.remove());\n  mapMarkers=visibleHappenings().map(item => { const marker=L.marker([item.publicLat,item.publicLng],{icon:L.divIcon({className:\"leaflet-marker-shell\",html:markerElement(item).outerHTML,iconSize:[125,70],iconAnchor:[62,35]})}).addTo(map); const pressState={pointerId:null,held:false,suppressUntil:0}; bindMarkerPress(marker,item,pressState); marker.on(\"click\",event => { if(pressState.suppressUntil>Date.now()){ pressState.suppressUntil=0; return; } L.DomEvent.stopPropagation(event); openMini(item); }); marker.on(\"contextmenu\",event => { L.DomEvent.stopPropagation(event); event.originalEvent.preventDefault(); openActions(item,event.originalEvent.clientX,event.originalEvent.clientY); }); return marker; });\n  document.getElementById(\"signalCount\").textContent=`${visibleHappenings().length} signals`;\n  const active=Object.entries(refineFilters).filter(([key,value]) => key === \"time\" ? value !== \"today\" : value !== \"all\").length; document.getElementById(\"filterCount\").textContent=active ? `(${active})` : \"\";\n}\nfunction fillMini(item){\n  document.getElementById(\"miniStatusDot\").style.background=statusColor(item.status); document.getElementById(\"miniStatus\").textContent=item.status; document.getElementById(\"miniTime\").textContent=item.time; document.getElementById(\"miniTitle\").textContent=item.title; document.getElementById(\"miniBody\").textContent=item.body; document.getElementById(\"miniLocation\").textContent=locationText(item); document.getElementById(\"miniScore\").textContent=`${item.score}% legit`; document.getElementById(\"miniMeter\").style.width=`${item.score}%`; document.getElementById(\"miniMeter\").style.background=`linear-gradient(90deg,${legitColor(item.score)},#35c978)`;\n}\nfunction openMini(item){ selectedHappening=item; closeActions(); fillMini(item); miniCard.hidden=false; }\nfunction openActions(item,x,y,focusMenu=false){ selectedHappening=item; miniCard.hidden=true; document.getElementById(\"actionTitle\").textContent=item.title; actionMenu.style.left=`${Math.min(Math.max(8,x),window.innerWidth-240)}px`; actionMenu.style.top=`${Math.min(Math.max(74,y),window.innerHeight-250)}px`; actionMenu.hidden=false; if(focusMenu) actionMenu.querySelector(\"[data-action]\")?.focus(); }\nfunction closeActions(){ actionMenu.hidden=true; }\nfunction showToast(message){ toast.textContent=message; toast.classList.add(\"show\"); clearTimeout(showToast.timer); showToast.timer=setTimeout(() => toast.classList.remove(\"show\"),2600); }\nfunction showModal(id){ const modal=document.getElementById(id); lastFocusedElement=document.activeElement; modal.hidden=false; const focusable=modal.querySelector(\"button,a[href],input,select,textarea,[tabindex]:not([tabindex='-1'])\"); focusable?.focus(); }\nfunction closeModal(id){ const modal=document.getElementById(id); modal.hidden=true; if(id === \"accessibilityPanel\") document.getElementById(\"openAccessibility\").setAttribute(\"aria-expanded\",\"false\"); if(lastFocusedElement && typeof lastFocusedElement.focus === \"function\") lastFocusedElement.focus(); }\nfunction populateDetail(item){\n  document.getElementById(\"detailStatusDot\").style.background=statusColor(item.status); document.getElementById(\"detailStatus\").textContent=item.status; document.getElementById(\"detailTime\").textContent=item.time; document.getElementById(\"detailTitle\").textContent=item.title; document.getElementById(\"detailBody\").textContent=item.body; document.getElementById(\"detailLocation\").textContent=locationText(item); document.getElementById(\"detailBalance\").textContent=`${balanceLabel(item.balance)} · medium confidence`; document.getElementById(\"detailImportance\").textContent=`${item.impact} / 5`; document.getElementById(\"detailScore\").textContent=`${item.score}%`; document.getElementById(\"detailClaim\").textContent=item.claim.text; document.getElementById(\"detailClaimAttribution\").textContent=`${item.claim.attribution} ${item.balanceBasis}`; document.getElementById(\"detailBasis\").textContent=item.legitimacyBasis || \"Legitimacy reflects evidence alignment, not popularity.\"; document.getElementById(\"detailSources\").textContent=`${item.evidence.length} trails`;\n  document.getElementById(\"sourceList\").innerHTML=item.evidence.map(evidence => `<div class=\"evidence-row\"><div class=\"evidence-avatar\">${escapeHtml(evidence.initials)}</div><div class=\"evidence-copy\"><strong>${escapeHtml(evidence.title)}</strong><p>${escapeHtml(evidence.excerpt)}</p><small>${escapeHtml(evidence.provenance)} · <button class=\"tiny-useful\" data-evidence-id=\"${escapeHtml(evidence.id)}\">↑ useful</button></small></div></div>`).join(\"\") || `<p class=\"privacy-line\">No approved evidence trail yet. The signal remains unverified.</p>`;\n  const historySection=document.getElementById(\"correctionHistorySection\"); const history=item.corrections || []; historySection.hidden=!history.length; document.getElementById(\"correctionHistory\").innerHTML=history.map(entry => `<div class=\"history-row\"><strong>${escapeHtml(entry.type === \"appeal\" ? \"Appeal resolved\" : \"Correction resolved\")}</strong><p>${escapeHtml(entry.summary)}</p><small>${escapeHtml(relativeTime(entry.createdAt))}</small></div>`).join(\"\");\n  document.querySelectorAll(\".tiny-useful\").forEach(button => button.addEventListener(\"click\",event => { event.stopPropagation(); recordEvidenceAssessment(item,button); }));\n}\nfunction openFull(item){ selectedHappening=item; closeActions(); miniCard.hidden=true; populateDetail(item); showModal(\"detailModal\"); }\nfunction openReport(item){ selectedHappening=item; closeActions(); miniCard.hidden=true; document.getElementById(\"reportTitle\").textContent=`Report or correct: ${item.title}`; document.getElementById(\"reportDetails\").value=\"\"; showModal(\"reportModal\"); }\nasync function recordEvidenceAssessment(item,button){\n  if(button.disabled) return; button.disabled=true;\n  const evidenceId=button.dataset.evidenceId || item.evidence[0]?.id; if(!evidenceId){ showToast(\"No evidence trail to upvote yet\"); button.disabled=false; return; }\n  try{ const response=await fetch(\"/api/reputation/assessment\",{method:\"POST\",headers:{\"content-type\":\"application/json\"},body:JSON.stringify({targetId:`${item.id}:${evidenceId}`,actionType:\"evidence_useful\"})}); const data=await response.json().catch(() => ({})); if(!response.ok) throw new Error(data.error || \"Useful evidence could not be recorded.\"); const assessment=data.assessment || {}; if(assessment.accepted) userState.points += assessment.pointsAwarded || 0; const held=assessment.riskState === \"coordination_review\"; button.textContent=assessment.accepted ? (held ? \"✓ held for review\" : \"✓ counted\") : \"already counted\"; showToast(assessment.accepted ? (held ? \"Useful evidence recorded; points are held for coordination review\" : `Useful evidence added · +${assessment.pointsAwarded} point${assessment.pointsAwarded === 1 ? \"\" : \"s\"}`) : (assessment.reason || \"This assessment was already counted\")); }catch(error){ button.disabled=false; showToast(error.message || \"Useful evidence could not be recorded.\"); }\n}\nfunction deskKey(item){ return item.serverId || `demo-${item.id}`; }\nfunction readLocalDesk(){ try{ const saved=JSON.parse(localStorage.getItem(deskStorageKey)||\"[]\"); return new Set(Array.isArray(saved) ? saved.filter(value => typeof value === \"string\") : []); }catch{ return new Set(); } }\nfunction saveLocalDesk(){ try{ localStorage.setItem(deskStorageKey,JSON.stringify([...deskState.keys])); }catch{} }\nfunction applyDeskState(){ happenings.forEach(item => { item.saved=deskState.keys.has(deskKey(item)); }); }\nasync function loadDesk(){\n  const localKeys=readLocalDesk();\n  try{\n    const response=await fetch(\"/api/desk\",{headers:{accept:\"application/json\"}});\n    if(response.status === 401){ deskState.server=false; deskState.keys=localKeys; applyDeskState(); return; }\n    if(!response.ok) throw new Error(\"Desk is unavailable.\");\n    const data=await response.json(); deskState.server=true; deskState.keys=new Set((data.items || []).map(item => item.happening_key)); applyDeskState(); renderMarkers();\n  }catch{ deskState.server=false; deskState.keys=localKeys; applyDeskState(); }\n}\nasync function toggleDesk(item){\n  const key=deskKey(item); const next=!item.saved; item.saved=next; if(next) deskState.keys.add(key); else deskState.keys.delete(key); if(!deskState.server) saveLocalDesk(); showToast(next ? \"Added to your desk\" : \"Removed from your desk\");\n  if(!deskState.server) return;\n  try{ const response=await fetch(\"/api/desk\",{method:\"POST\",headers:{\"content-type\":\"application/json\"},body:JSON.stringify({action:next ? \"save\" : \"remove\",happeningKey:key})}); if(!response.ok) throw new Error(\"Desk could not be updated.\"); }\n  catch{ item.saved=!next; if(next) deskState.keys.delete(key); else deskState.keys.add(key); showToast(\"Desk could not be updated; try again\"); }\n}\nasync function submitReport(event){\n  event.preventDefault();\n  const details=document.getElementById(\"reportDetails\").value.trim(); if(!details){ showToast(\"Add details for reviewers first\"); return; }\n  const submit=event.currentTarget.querySelector('button[type=\"submit\"]'); submit.disabled=true; submit.textContent=\"Sending…\";\n  try{ const response=await fetch(\"/api/reports\",{method:\"POST\",headers:{\"content-type\":\"application/json\"},body:JSON.stringify({targetType:\"happening\",targetId:selectedHappening?.id,reason:document.getElementById(\"reportReason\").value,details})}); const data=await response.json().catch(() => ({})); if(!response.ok) throw new Error(data.error || \"Report could not be submitted.\"); closeModal(\"reportModal\"); showToast(data.report?.message || \"Submitted for review\"); }\n  catch(error){ showToast(error.message || \"Report could not be submitted.\"); }\n  finally{ submit.disabled=false; submit.textContent=\"Send for review\"; }\n}\nfunction runAction(action){\n  if(!selectedHappening) return; const item=selectedHappening; closeActions();\n  if(action === \"add\"){ toggleDesk(item); return; }\n  if(action === \"full\"){ openFull(item); return; }\n  if(action === \"useful\"){ const evidence=item.evidence[0]; if(!evidence){ showToast(\"No evidence trail to upvote yet\"); return; } recordEvidenceAssessment(item,{disabled:false,dataset:{evidenceId:evidence.id},textContent:\"↑ useful\"}); return; }\n  if(action === \"report\"){ openReport(item); }\n}\nfunction resetComposer(){ document.getElementById(\"composerForm\").reset(); document.getElementById(\"identityField\").hidden=true; document.getElementById(\"anonymousToggle\").checked=true; document.getElementById(\"locationPrivacy\").value=\"aggregate\"; }\nfunction setProfileControls(enabled,profile){\n  const status=document.getElementById(\"profileAuthStatus\"); const optOut=document.getElementById(\"profileOptOutSharing\"); const limit=document.getElementById(\"profileLimitSensitive\"); const correction=document.getElementById(\"correctionDetails\"); const correctionButton=document.getElementById(\"requestCorrection\"); const exportButton=document.getElementById(\"exportMyData\"); const deleteButton=document.getElementById(\"deleteAllData\");\n  optOut.disabled=true;\n  [limit,correction,correctionButton,exportButton,deleteButton].forEach(control => { control.disabled=!enabled; });\n  status.textContent=enabled ? \"Signed in\" : \"Sign in to manage\";\n  optOut.checked=true;\n  if(profile){ limit.checked=profile.controls.limitSensitive; document.getElementById(\"profileDataSummary\").textContent=`${profile.dataSummary.happenings} profile-linked happening${profile.dataSummary.happenings === 1 ? \"\" : \"s\"} · ${profile.dataSummary.deskItems || 0} desk item${profile.dataSummary.deskItems === 1 ? \"\" : \"s\"} · ${profile.dataSummary.pending} pending review · ${profile.dataSummary.reputationEvents || 0} signed-in reputation event${profile.dataSummary.reputationEvents === 1 ? \"\" : \"s\"}`; } else { limit.checked=true; }\n}\nasync function loadPrivacyProfile(){\n  const summary=document.getElementById(\"profileDataSummary\"); summary.textContent=\"Checking profile-linked data…\";\n  try{ const response=await fetch(\"/api/profile/privacy\",{headers:{accept:\"application/json\"}}); const data=await response.json().catch(() => ({})); if(response.status === 401){ setProfileControls(false); summary.textContent=\"Sign in to view or manage profile-linked data. Anonymous contributions remain aggregated.\"; return; } if(!response.ok) throw new Error(data.error || \"Privacy controls are unavailable.\"); setProfileControls(true,data); }catch(error){ setProfileControls(false); summary.textContent=error.message || \"Privacy controls are unavailable.\"; }\n}\nasync function savePrivacyPreferences(){\n  const summary=document.getElementById(\"profileDataSummary\"); summary.textContent=\"Saving privacy preferences…\";\n  try{ const response=await fetch(\"/api/profile/privacy\",{method:\"POST\",headers:{\"content-type\":\"application/json\"},body:JSON.stringify({action:\"save_preferences\",optOutSharing:document.getElementById(\"profileOptOutSharing\").checked,limitSensitive:document.getElementById(\"profileLimitSensitive\").checked})}); const data=await response.json().catch(() => ({})); if(!response.ok) throw new Error(data.error || \"Privacy preferences could not be saved.\"); summary.textContent=\"Privacy preferences saved. Aggregated storage remains always on.\"; }catch(error){ summary.textContent=error.message || \"Privacy preferences could not be saved.\"; }\n}\nasync function submitCorrectionRequest(){\n  const details=document.getElementById(\"correctionDetails\").value.trim(); if(!details){ showToast(\"Describe what should be corrected first\"); return; }\n  const button=document.getElementById(\"requestCorrection\"); const summary=document.getElementById(\"profileDataSummary\"); button.disabled=true; summary.textContent=\"Submitting correction request…\";\n  try{ const response=await fetch(\"/api/profile/privacy\",{method:\"POST\",headers:{\"content-type\":\"application/json\"},body:JSON.stringify({action:\"correction_request\",details})}); const data=await response.json().catch(() => ({})); if(!response.ok) throw new Error(data.error || \"Correction request could not be submitted.\"); document.getElementById(\"correctionDetails\").value=\"\"; summary.textContent=\"Correction request submitted for review.\"; }catch(error){ summary.textContent=error.message || \"Correction request could not be submitted.\"; }finally{ button.disabled=false; }\n}\nasync function exportMyData(){\n  const button=document.getElementById(\"exportMyData\"); button.disabled=true;\n  try{ const response=await fetch(\"/api/profile/privacy/export\",{headers:{accept:\"application/json\"}}); const data=await response.json().catch(() => ({})); if(!response.ok) throw new Error(data.error || \"Data export is unavailable.\"); const blob=new Blob([JSON.stringify(data,null,2)],{type:\"application/json\"}); const url=URL.createObjectURL(blob); const link=document.createElement(\"a\"); link.href=url; link.download=\"legit-data-export.json\"; link.click(); URL.revokeObjectURL(url); showToast(\"Your aggregated data export is ready\"); }catch(error){ showToast(error.message || \"Data export is unavailable.\"); }finally{ button.disabled=false; }\n}\nasync function deleteAllProfileData(){\n  if(!window.confirm(\"Delete all data linked to this signed-in profile? This removes your profile-linked happenings, evidence, and privacy preferences. Anonymous aggregated reports are not linked to this profile.\")) return;\n  const button=document.getElementById(\"deleteAllData\"); const summary=document.getElementById(\"profileDataSummary\"); button.disabled=true; summary.textContent=\"Deleting profile-linked data…\";\n  try{ const response=await fetch(\"/api/profile/privacy\",{method:\"POST\",headers:{\"content-type\":\"application/json\"},body:JSON.stringify({action:\"delete_all\"})}); const data=await response.json().catch(() => ({})); if(!response.ok) throw new Error(data.error || \"Profile data could not be deleted.\"); localStorage.removeItem(accessibilityKey); setProfileControls(true,{controls:{optOutSharing:true,limitSensitive:true},dataSummary:{happenings:0,pending:0,reputationEvents:0}}); summary.textContent=`Deleted ${data.deletion?.deletedHappenings || 0} profile-linked happening${data.deletion?.deletedHappenings === 1 ? \"\" : \"s\"} and ${data.deletion?.deletedReputationEvents || 0} reputation event${data.deletion?.deletedReputationEvents === 1 ? \"\" : \"s\"}.`; showToast(\"All profile-linked data was deleted\"); }catch(error){ summary.textContent=error.message || \"Profile data could not be deleted.\"; button.disabled=false; }\n}\n\ndocument.getElementById(\"openFilters\").addEventListener(\"click\",() => { closeActions(); document.getElementById(\"filterPanel\").hidden=!document.getElementById(\"filterPanel\").hidden; });\ndocument.getElementById(\"openComposer\").addEventListener(\"click\",() => { closeActions(); showModal(\"composerModal\"); });\ndocument.getElementById(\"openAccount\").addEventListener(\"click\",() => { closeActions(); showModal(\"accountModal\"); loadPrivacyProfile(); loadDesk(); });\ndocument.getElementById(\"openAccessibility\").addEventListener(\"click\",() => { const panel=document.getElementById(\"accessibilityPanel\"); if(!panel.hidden){ closeModal(\"accessibilityPanel\"); return; } closeActions(); document.getElementById(\"filterPanel\").hidden=true; showModal(\"accessibilityPanel\"); document.getElementById(\"openAccessibility\").setAttribute(\"aria-expanded\",\"true\"); });\ndocument.getElementById(\"accessTextSize\").addEventListener(\"change\",event => { accessibilityState.textSize=event.target.value; saveAccessibility(); applyAccessibility(); showToast(`Text size set to ${event.target.options[event.target.selectedIndex].text}.`); });\n[[\"accessHighContrast\",\"highContrast\",\"High contrast\"],[\"accessReducedMotion\",\"reducedMotion\",\"Reduced motion\"],[\"accessMapLabels\",\"mapLabels\",\"Map labels\"]].forEach(([id,key,label]) => document.getElementById(id).addEventListener(\"change\",event => { accessibilityState[key]=event.target.checked; saveAccessibility(); applyAccessibility(); showToast(`${label} ${event.target.checked ? \"on\" : \"off\"}.`); }));\ndocument.getElementById(\"profileOptOutSharing\").addEventListener(\"change\",savePrivacyPreferences);\ndocument.getElementById(\"profileLimitSensitive\").addEventListener(\"change\",savePrivacyPreferences);\ndocument.getElementById(\"requestCorrection\").addEventListener(\"click\",submitCorrectionRequest);\ndocument.getElementById(\"exportMyData\").addEventListener(\"click\",exportMyData);\ndocument.getElementById(\"deleteAllData\").addEventListener(\"click\",deleteAllProfileData);\ndocument.querySelectorAll(\"[data-close]\").forEach(button => button.addEventListener(\"click\",() => { const target=button.dataset.close; if(target === \"miniCard\") miniCard.hidden=true; else closeModal(target); }));\ndocument.querySelectorAll(\".modal-backdrop\").forEach(backdrop => backdrop.addEventListener(\"click\",event => { if(event.target === backdrop) closeModal(backdrop.id); }));\ndocument.querySelectorAll(\"#filterPanel select\").forEach(select => select.addEventListener(\"change\",event => { refineFilters[event.target.id.replace(\"Filter\",\"\")]=event.target.value; renderMarkers(); }));\nconst timePresets=[\"Today\",\"Yesterday\",\"Last week\",\"Last month\",\"Last year\",\"All time\"];\nconst timeValues=[\"today\",\"yesterday\",\"week\",\"month\",\"year\",\"all\"];\nfunction setTimePreset(index){ const safeIndex=Math.max(0,Math.min(timeValues.length-1,index)); refineFilters.time=timeValues[safeIndex]; document.getElementById(\"timeValue\").textContent=timePresets[safeIndex]; document.getElementById(\"timeRange\").setAttribute(\"aria-valuetext\",timePresets[safeIndex]); renderMarkers(); window.clearTimeout(publicLoadTimer); publicLoadTimer=window.setTimeout(loadPublicHappenings,180); }\ndocument.getElementById(\"timeRange\").addEventListener(\"input\",event => setTimePreset(Number(event.target.value)));\ndocument.querySelectorAll(\"[data-action]\").forEach(button => button.addEventListener(\"click\",() => runAction(button.dataset.action)));\ndocument.getElementById(\"miniAdd\").addEventListener(\"click\",() => { if(selectedHappening) toggleDesk(selectedHappening); });\ndocument.getElementById(\"miniUseful\").addEventListener(\"click\",() => { if(selectedHappening) runAction(\"useful\"); });\ndocument.getElementById(\"miniFull\").addEventListener(\"click\",() => { if(selectedHappening) openFull(selectedHappening); });\ndocument.getElementById(\"detailAdd\").addEventListener(\"click\",() => { if(selectedHappening) toggleDesk(selectedHappening); });\ndocument.getElementById(\"detailUseful\").addEventListener(\"click\",() => { if(selectedHappening) runAction(\"useful\"); });\ndocument.getElementById(\"detailReport\").addEventListener(\"click\",() => { if(selectedHappening) openReport(selectedHappening); });\ndocument.getElementById(\"reportForm\").addEventListener(\"submit\",submitReport);\ndocument.getElementById(\"anonymousToggle\").addEventListener(\"change\",event => { document.getElementById(\"identityField\").hidden=event.target.checked; if(event.target.checked) document.getElementById(\"postIdentity\").value=\"\"; });\ndocument.getElementById(\"locationPrivacy\").addEventListener(\"change\",event => { event.target.value=\"aggregate\"; });\ndocument.getElementById(\"composerForm\").addEventListener(\"submit\",async event => { event.preventDefault(); const form=event.currentTarget; const title=document.getElementById(\"postTitle\").value.trim(); const body=document.getElementById(\"postBody\").value.trim(); const location=document.getElementById(\"postLocation\").value.trim(); if(!title || !body || !location) return; const submit=form.querySelector('button[type=\"submit\"]'); submit.disabled=true; submit.textContent=\"Queueing…\"; const anonymous=document.getElementById(\"anonymousToggle\").checked; const identity=anonymous ? \"Anonymous\" : (document.getElementById(\"postIdentity\").value.trim() || \"Contributor\"); const baseLat=43.665+(Math.random()-.5)*.008; const baseLng=-70.26+(Math.random()-.5)*.012; try{ const response=await fetch(\"/api/happenings\",{method:\"POST\",headers:{\"content-type\":\"application/json\"},body:JSON.stringify({title,body,location,topic:document.getElementById(\"postTopic\").value,lat:baseLat,lng:baseLng,identityVisibility:anonymous ? \"anonymous\" : \"attributed\",displayIdentity:anonymous ? null : identity,source:document.getElementById(\"postSource\").value.trim(),attachments:[]})}); const data=await response.json().catch(() => ({})); if(!response.ok) throw new Error(data.error || \"The privacy gate could not queue this signal.\"); const item={id:100+postCounter++,serverId:data.happening?.id,title,body,location,topic:document.getElementById(\"postTopic\").value,status:\"Unverified\",time:\"just now\",ageMinutes:0,balance:\"agnostic\",score:0,impact:1,reports:1,publicLat:data.happening?.publicLat ?? Math.round(baseLat*1000)/1000,publicLng:data.happening?.publicLng ?? Math.round(baseLng*1000)/1000,claim:{text:body,attribution:\"Queued through the privacy and moderation gate.\"},evidence:[],balanceBasis:\"No independent perspective comparison yet.\",saved:false}; happenings.unshift(item); renderMarkers(); closeModal(\"composerModal\"); resetComposer(); openMini(item); showToast(\"Signal queued — public display waits for review\"); }catch(error){ showToast(error.message || \"Signal could not be queued\"); }finally{ submit.disabled=false; submit.textContent=\"Post signal\"; } });\ndocument.addEventListener(\"keydown\",event => { const activeModal=document.querySelector(\".modal-backdrop:not([hidden]), .access-panel:not([hidden])\"); if(event.key === \"Tab\" && activeModal){ const focusables=[...activeModal.querySelectorAll(\"button,a[href],input,select,textarea,[tabindex]:not([tabindex='-1'])\")].filter(element => !element.disabled); if(focusables.length){ const first=focusables[0]; const last=focusables[focusables.length-1]; if(event.shiftKey && document.activeElement === first){ event.preventDefault(); last.focus(); } else if(!event.shiftKey && document.activeElement === last){ event.preventDefault(); first.focus(); } } } if(event.key === \"Escape\"){ closeActions(); miniCard.hidden=true; document.getElementById(\"filterPanel\").hidden=true; document.querySelectorAll(\".modal-backdrop:not([hidden]), .access-panel:not([hidden])\").forEach(modal => closeModal(modal.id)); document.getElementById(\"openAccessibility\").setAttribute(\"aria-expanded\",\"false\"); } });\n\nloadAccessibility(); applyAccessibility(); loadDesk();\n\nfunction initMap(){\n  if(!window.L) return; map=L.map(\"map\",{zoomControl:false,attributionControl:true}).setView([43.665,-70.26],12.6); L.tileLayer(\"https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png\",{maxZoom:19,attribution:\"© OpenStreetMap contributors\"}).addTo(map); L.control.zoom({position:\"bottomright\"}).addTo(map); map.on(\"click\",() => { closeActions(); miniCard.hidden=true; }); map.on(\"contextmenu\",event => { event.originalEvent.preventDefault(); closeActions(); miniCard.hidden=true; showToast(\"Right-click a marker to see event actions\"); }); renderMarkers();\n}\ninitMap();\nloadPublicHappenings();\nlet refreshTimer=null;\nfunction scheduleLiveRefresh(){ window.clearTimeout(refreshTimer); refreshTimer=window.setTimeout(() => { if(document.visibilityState === \"visible\") loadPublicHappenings(); scheduleLiveRefresh(); },30000); }\ndocument.addEventListener(\"visibilitychange\",() => { if(document.visibilityState === \"visible\") loadPublicHappenings(); });\nscheduleLiveRefresh();\ndocument.addEventListener(\"keydown\",event => {\n  if(actionMenu.hidden) return;\n  const actions=[...actionMenu.querySelectorAll(\"[data-action]\")];\n  const index=actions.indexOf(document.activeElement);\n  if(event.key === \"ArrowDown\" || event.key === \"ArrowUp\"){\n    event.preventDefault();\n    actions[(index + (event.key === \"ArrowDown\" ? 1 : actions.length - 1)) % actions.length]?.focus();\n  }\n});\n","type":"text/javascript; charset=utf-8"}};
const rateBuckets = new Map();
const MAX_RATE_BUCKETS = 5000;
let cleanupInFlight = null;
let cleanupLastStarted = 0;

const securityHeaders = {
  "x-content-type-options":"nosniff",
  "x-frame-options":"DENY",
  "referrer-policy":"strict-origin-when-cross-origin",
  "permissions-policy":"camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  "cross-origin-opener-policy":"same-origin",
  "cross-origin-resource-policy":"same-origin",
  "x-permitted-cross-domain-policies":"none",
  "strict-transport-security":"max-age=31536000; includeSubDomains",
  "content-security-policy":"default-src 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self' https://unpkg.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://unpkg.com; style-src-attr 'unsafe-inline'; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob: https://unpkg.com https://*.tile.openstreetmap.org https://*.openstreetmap.org; connect-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com https://unpkg.com; upgrade-insecure-requests"
};
const jsonHeaders = {...securityHeaders,"content-type":"application/json; charset=utf-8","cache-control":"no-store"};
const policy = {
  version:"privacy-moderation-v2",
  identity:"anonymous by default; attributed display is opt-in",
  location:"all stored locations are rounded to neighborhood precision; exact pins are never stored",
  media:"uploads are never public at low legitimacy; the server receives metadata only until media review is complete",
  review:"new happenings enter a private moderation queue before public display",
  retention:"unverified submissions receive a bounded retention window and an append-only moderation history",
  storage:"raw request bodies are discarded; identifying text is filtered before storage, and signed-in ownership is represented only by an opaque hash",
  sharing:"Legit does not sell or share personal information for cross-context behavioral advertising"
};
const reputationRules = {
  evidenceUseful:{base:2,decay:1.5},
  dailyCap:10,
  sameStoryCap:1,
  coordinationWindowMinutes:15,
  coordinationMinAssessments:4,
  coordinationMinActors:3,
  duplicateRule:"one assessment per actor fingerprint, action, target, and story",
  excluded:"raw post volume, popularity, and agreement with a claim"
};
const durableWriteLimits = {
  "/api/happenings":4,
  "/api/reports":6,
  "/api/reputation/assessment":20,
  "/api/profile/privacy":10,
  "/api/desk":20,
  "/api/moderation/actions":20,
  "/api/moderation/verify":8,
  "/api/moderation/tasks":30,
  "/api/moderation/quality":15
};

function jsonResponse(body,status=200,extraHeaders={}){ return new Response(JSON.stringify(body),{status,headers:{...jsonHeaders,...extraHeaders}}); }
function textResponse(body,type){ return new Response(body,{headers:{...securityHeaders,"content-type":type,"cache-control":"no-cache"}}); }
function sanitizeText(value,max=1000){
  return (typeof value === "string" ? value : "")
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,"[email removed]")
    .replace(/\b(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?){2}\d{4}\b/g,"[phone removed]")
    .replace(/\b\d{1,5}\s+[A-Za-z0-9.'-]+\s+(?:Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Lane|Ln|Boulevard|Blvd|Court|Ct|Way)\b/gi,"[address removed]")
    .trim().slice(0,max);
}
function roundCoordinate(value){ return Math.round(value * 1000) / 1000; }
function finiteCoordinate(value,min,max){ const number = Number(value); return Number.isFinite(number) && number >= min && number <= max ? number : null; }
function publicCoordinate(value){ return roundCoordinate(value); }
function retentionDate(){ return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); }
function aggregateArea(value){ return sanitizeText(value,140).replace(/\b\d{1,5}\b/g,"").replace(/\s+/g," ").trim().slice(0,140); }
function aggregateSource(value){
  const text = sanitizeText(value,500);
  if(!text) return "";
  try { const url = new URL(text); return `${url.origin}${url.pathname}`.slice(0,300); }
  catch { return text.replace(/\s+/g," ").slice(0,300); }
}
async function ownerKey(request){
  const userId = String(request.headers.get("oai-authenticated-user-id") || "").trim();
  if(!userId) throw accessError("Sign in to manage profile data.",401);
  const digest = await crypto.subtle.digest("SHA-256",new TextEncoder().encode(`legit-owner-v1|${userId}`));
  return [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2,"0")).join("").slice(0,48);
}
async function ensurePrivacySchema(env){
  if(!env.DB) throw accessError("Durable privacy storage is unavailable.",503);
}
async function purgeExpiredRecords(env){
  if(!env.DB) return {deletedHappenings:0,deletedReputationEvents:0};
  const now = new Date().toISOString();
  const abuseCutoff = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  await env.DB.prepare("DELETE FROM abuse_buckets WHERE bucket_start < ?").bind(abuseCutoff).run();
  await env.DB.prepare("DELETE FROM moderator_verification_events WHERE expires_at < ?").bind(now).run();
  const expiredWhere = "review_state IN ('pending', 'flagged') AND retention_until IS NOT NULL AND retention_until < ?";
  const count = await env.DB.prepare(`SELECT COUNT(*) AS total FROM happenings WHERE ${expiredWhere}`).bind(now).first();
  const deletedHappenings = Number(count?.total || 0);
  if(!deletedHappenings) return {deletedHappenings:0,deletedReputationEvents:0};
  await env.DB.batch([
    env.DB.prepare(`DELETE FROM moderation_reports WHERE target_id IN (SELECT id FROM happenings WHERE ${expiredWhere}) OR target_id IN (SELECT id FROM claims WHERE happening_id IN (SELECT id FROM happenings WHERE ${expiredWhere})) OR target_id IN (SELECT id FROM evidence WHERE claim_id IN (SELECT id FROM claims WHERE happening_id IN (SELECT id FROM happenings WHERE ${expiredWhere})))`).bind(now,now,now),
    env.DB.prepare(`DELETE FROM evidence WHERE claim_id IN (SELECT id FROM claims WHERE happening_id IN (SELECT id FROM happenings WHERE ${expiredWhere}))`).bind(now),
    env.DB.prepare(`DELETE FROM moderation_decisions WHERE happening_id IN (SELECT id FROM happenings WHERE ${expiredWhere})`).bind(now),
    env.DB.prepare(`DELETE FROM claims WHERE happening_id IN (SELECT id FROM happenings WHERE ${expiredWhere})`).bind(now),
    env.DB.prepare(`DELETE FROM happenings WHERE ${expiredWhere}`).bind(now),
    env.DB.prepare("INSERT INTO privacy_deletion_audit (id,scope,deleted_happenings,deleted_reputation_events,created_at) VALUES (?,?,?,?,?)").bind(crypto.randomUUID(),"retention",deletedHappenings,0,now)
  ]);
  return {deletedHappenings,deletedReputationEvents:0};
}
function scheduleRetentionCleanup(env,ctx){
  if(!env.DB || cleanupInFlight || Date.now() - cleanupLastStarted < 60000) return;
  cleanupLastStarted = Date.now();
  cleanupInFlight = purgeExpiredRecords(env).catch(() => null).finally(() => { cleanupInFlight = null; });
  if(ctx?.waitUntil) ctx.waitUntil(cleanupInFlight);
}
async function readJson(request){
  const length = Number(request.headers.get("content-length") || 0);
  if(length > MAX_BODY_BYTES) throw new Error("Submission is too large for the privacy gate.");
  const contentType = request.headers.get("content-type") || "";
  if(!/^application\/json(?:\s*;|$)/i.test(contentType)) throw accessError("JSON content is required.",415);
  const raw = await request.text();
  if(new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) throw new Error("Submission is too large for the privacy gate.");
  try { return JSON.parse(raw || "{}"); } catch { throw new Error("Submission must be valid JSON."); }
}
async function allowRequest(request,scope="write"){
  const rawKey = request.headers.get("CF-Connecting-IP") || "shared-anonymous-client";
  const digest = await crypto.subtle.digest("SHA-256",new TextEncoder().encode(rawKey));
  const key = `${scope}:${[...new Uint8Array(digest)].map(value => value.toString(16).padStart(2,"0")).join("")}`;
  const bucket = Math.floor(Date.now() / 60000);
  for(const [storedKey,value] of rateBuckets){ if(value.bucket < bucket - 1) rateBuckets.delete(storedKey); }
  if(!rateBuckets.has(key) && rateBuckets.size >= MAX_RATE_BUCKETS){ const oldestKey=rateBuckets.keys().next().value; if(oldestKey) rateBuckets.delete(oldestKey); }
  const current = rateBuckets.get(key);
  if(!current || current.bucket !== bucket){ rateBuckets.set(key,{bucket,count:1}); return true; }
  current.count += 1;
  return current.count <= 8;
}
async function allowDurableRequest(env,request,scope){
  if(!env.DB) return true;
  const limit = durableWriteLimits[scope] || 20;
  const fingerprint = scope.startsWith("/api/moderation") ? await moderatorRateFingerprint(request) : await actorFingerprint(request);
  const bucketStart = new Date(Math.floor(Date.now() / 60000) * 60000).toISOString();
  const current = await env.DB.prepare("SELECT request_count FROM abuse_buckets WHERE actor_fingerprint=? AND scope=? AND bucket_start=? LIMIT 1").bind(fingerprint,scope,bucketStart).first();
  const count = Number(current?.request_count || 0);
  if(count >= limit) return false;
  const nextCount = count + 1;
  if(current){
    await env.DB.prepare("UPDATE abuse_buckets SET request_count=?,updated_at=? WHERE actor_fingerprint=? AND scope=? AND bucket_start=?").bind(nextCount,new Date().toISOString(),fingerprint,scope,bucketStart).run();
  }else{
    await env.DB.prepare("INSERT INTO abuse_buckets (actor_fingerprint,scope,bucket_start,request_count,updated_at) VALUES (?,?,?,?,?)").bind(fingerprint,scope,bucketStart,nextCount,new Date().toISOString()).run();
  }
  return true;
}
async function moderatorRateFingerprint(request){
  const raw = request.headers.get("authorization") || "missing-moderator-credential";
  const digest = await crypto.subtle.digest("SHA-256",new TextEncoder().encode(`legit-moderator-rate-v1|${raw}`));
  return [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2,"0")).join("").slice(0,32);
}
function requireText(value,label,max){ const text = sanitizeText(value,max); if(!text) throw new Error(`${label} is required.`); return text; }
function normalizeHappening(input){
  const title = requireText(input.title,"A short description",90);
  const body = requireText(input.body,"What happened",420);
  const location = requireText(aggregateArea(input.location),"A public area",140);
  const shareIdentity = input.identityVisibility === "attributed" && Boolean(sanitizeText(input.displayIdentity,40));
  const lat = finiteCoordinate(input.lat,-90,90);
  const lng = finiteCoordinate(input.lng,-180,180);
  const publicLat = lat == null ? null : publicCoordinate(lat);
  const publicLng = lng == null ? null : publicCoordinate(lng);
  const attachmentCount = Array.isArray(input.attachments) ? Math.min(input.attachments.length,10) : 0;
  return {
    id: crypto.randomUUID(),
    title,body,location,
    topic: requireText(input.topic || "Other","Topic",40),
    publicLat,publicLng,
    locationPrecision:"aggregate",
    identityVisibility: shareIdentity ? "attributed" : "anonymous",
    identityDisplay: shareIdentity ? sanitizeText(input.displayIdentity,40) : null,
    attachmentCount,
    attachmentState: attachmentCount ? "private_review" : "none",
    reviewState:"pending",
    createdAt:new Date().toISOString(),
    retentionUntil:retentionDate(),
    source:aggregateSource(input.source)
  };
}
async function persistHappening(env,item,request){
  if(!env.DB) throw new Error("Durable moderation storage is unavailable.");
  await ensurePrivacySchema(env);
  const owner = request.headers.get("oai-authenticated-user-id") ? await ownerKey(request) : null;
  const claimId = `claim-${item.id}`;
  const statements = [
    env.DB.prepare(`INSERT INTO happenings (id,title,body,topic,public_location,public_lat,public_lng,location_precision,identity_visibility,identity_display,impact,balance,legitimacy_score,review_state,attachment_state,attachment_count,created_at,retention_until,owner_key) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(item.id,item.title,item.body,item.topic,item.location,item.publicLat,item.publicLng,item.locationPrecision,item.identityVisibility,item.identityDisplay,1,"agnostic",0,item.reviewState,item.attachmentState,item.attachmentCount,item.createdAt,item.retentionUntil,owner),
    env.DB.prepare(`INSERT INTO claims (id,happening_id,text,status,attribution,created_at) VALUES (?,?,?,?,?,?)`).bind(claimId,item.id,item.body,"unverified","Queued through the server-side privacy and moderation gate.",item.createdAt)
  ];
  if(item.source){
    statements.push(env.DB.prepare(`INSERT INTO evidence (id,claim_id,evidence_type,relationship,provenance,review_state,submitted_at) VALUES (?,?,?,?,?,?,?)`).bind(`evidence-${item.id}`,claimId,"Submitted source","supports",item.source,"pending",item.createdAt));
  }
  await env.DB.batch(statements);
}
async function persistReport(env,input,request){
  if(!env.DB) throw new Error("Durable moderation storage is unavailable.");
  const targetId = requireText(input.targetId,"A target",160);
  const reason = requireText(input.reason,"A reason",40).toLowerCase();
  const details = sanitizeText(input.details,500);
  const targetType = input.targetType || "happening";
  if(!["happening","claim","evidence"].includes(targetType)) throw new Error("This report target is not supported.");
  const createdAt = new Date().toISOString();
  const owner = request?.headers.get("oai-authenticated-user-id") ? await ownerKey(request) : null;
  await env.DB.prepare(`INSERT INTO moderation_reports (id,target_type,target_id,reason,details,review_state,reporter_owner_key,created_at) VALUES (?,?,?,?,?,?,?,?)`).bind(crypto.randomUUID(),targetType,targetId,reason,details,"pending",owner,createdAt).run();
  return {reviewState:"pending",message:"Submitted for review. No identity or exact location is made public."};
}
async function actorFingerprint(request){
  const raw = `${request.headers.get("CF-Connecting-IP") || "shared-anonymous-client"}|${request.headers.get("user-agent") || "unknown"}`;
  const digest = await crypto.subtle.digest("SHA-256",new TextEncoder().encode(raw));
  return [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2,"0")).join("").slice(0,32);
}
function assessmentStoryId(targetId){
  const separator = targetId.indexOf(":");
  return separator > 0 ? targetId.slice(0,separator) : null;
}
async function persistAssessment(env,request,input){
  if(!env.DB) throw new Error("Durable reputation storage is unavailable.");
  const actionType = requireText(input.actionType,"An assessment type",40);
  if(actionType !== "evidence_useful") throw new Error("This assessment type is not enabled.");
  const targetId = requireText(input.targetId,"A target",160);
  const fingerprint = await actorFingerprint(request);
  const owner = request.headers.get("oai-authenticated-user-id") ? await ownerKey(request) : null;
  const actionDay = new Date().toISOString().slice(0,10);
  const existing = await env.DB.prepare(`SELECT id FROM reputation_events WHERE actor_fingerprint=? AND action_type=? AND target_id=? LIMIT 1`).bind(fingerprint,actionType,targetId).first();
  if(existing) return {accepted:false,pointsAwarded:0,reason:"Already counted"};
  const storyId = assessmentStoryId(targetId);
  if(storyId){
    const storyExisting = await env.DB.prepare(`SELECT id FROM reputation_events WHERE actor_fingerprint=? AND action_type=? AND target_id LIKE ? LIMIT 1`).bind(fingerprint,actionType,`${storyId}:%`).first();
    if(storyExisting) return {accepted:false,pointsAwarded:0,reason:"Already counted for this story"};
  }
  const countRow = await env.DB.prepare(`SELECT COUNT(*) AS total FROM reputation_events WHERE actor_fingerprint=? AND action_type=? AND action_day=?`).bind(fingerprint,actionType,actionDay).first();
  const count = Number(countRow?.total || 0);
  if(count >= reputationRules.dailyCap) return {accepted:false,pointsAwarded:0,reason:"Daily assessment limit reached"};
  const createdAt = new Date().toISOString();
  const coordinationSince = new Date(Date.now() - reputationRules.coordinationWindowMinutes * 60 * 1000).toISOString();
  const recent = storyId && storyId.startsWith("public-")
    ? await env.DB.prepare(`SELECT COUNT(*) AS events, COUNT(DISTINCT actor_fingerprint) AS actors FROM reputation_events WHERE action_type=? AND target_id LIKE ? AND created_at >= ?`).bind(actionType,`${storyId}:%`,coordinationSince).first()
    : null;
  const coordinationReview = Boolean(recent && Number(recent.events || 0) + 1 >= reputationRules.coordinationMinAssessments && Number(recent.actors || 0) + 1 >= reputationRules.coordinationMinActors);
  const pointsAwarded = coordinationReview ? 0 : Math.max(1,Math.floor(reputationRules.evidenceUseful.base / Math.pow(reputationRules.evidenceUseful.decay,count)));
  const basis = coordinationReview
    ? "Useful evidence recorded; points held for coordination review."
    : "Useful evidence assessment; duplicate, story, daily-cap, and coordination checks passed.";
  await env.DB.prepare(`INSERT INTO reputation_events (id,actor_fingerprint,action_type,target_id,action_day,points_awarded,basis,risk_state,created_at,owner_key) VALUES (?,?,?,?,?,?,?,?,?,?)`).bind(crypto.randomUUID(),fingerprint,actionType,targetId,actionDay,pointsAwarded,basis,coordinationReview ? "coordination_review" : "normal",createdAt,owner).run();
  return {accepted:true,pointsAwarded,riskState:coordinationReview ? "coordination_review" : "normal",basis:"Evidence usefulness, not claim agreement"};
}
async function moderationStatus(env){
  if(!env.DB) throw new Error("Durable moderation storage is unavailable.");
  const states = await env.DB.prepare(`SELECT review_state, COUNT(*) AS total FROM happenings GROUP BY review_state`).all();
  const media = await env.DB.prepare(`SELECT COUNT(*) AS total FROM happenings WHERE attachment_state='private_review'`).first();
  const evidence = await env.DB.prepare(`SELECT COUNT(*) AS total FROM evidence WHERE review_state='pending'`).first();
  const reports = await env.DB.prepare(`SELECT COUNT(*) AS total FROM moderation_reports WHERE review_state='pending'`).first();
  const privacyRequests = await env.DB.prepare(`SELECT COUNT(*) AS total FROM privacy_requests WHERE status='pending'`).first();
  const corrections = await env.DB.prepare(`SELECT COUNT(*) AS total FROM moderation_reports WHERE review_state='pending' AND reason IN ('correction','appeal')`).first();
  const coordination = await env.DB.prepare(`SELECT COUNT(DISTINCT target_id) AS total FROM reputation_events WHERE risk_state='coordination_review'`).first();
  const summary = {pending:0,cleared:0,flagged:0,privateMedia:Number(media?.total || 0),pendingEvidence:Number(evidence?.total || 0),pendingReports:Number(reports?.total || 0),pendingCorrections:Number(corrections?.total || 0),pendingPrivacyRequests:Number(privacyRequests?.total || 0),coordinationReviews:Number(coordination?.total || 0)};
  for(const row of states.results || []){
    const count = Number(row.total || 0);
    if(row.review_state === "pending") summary.pending += count;
    else if(row.review_state === "cleared" || row.review_state === "approved") summary.cleared += count;
    else summary.flagged += count;
  }
  return {policyVersion:policy.version,publicSummary:summary,disclosure:"Counts only; identities, exact locations, private media, and report text stay out of this public endpoint."};
}
function publicWindow(windowName){
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  if(windowName === "yesterday") return {from:new Date(now - 2 * day).toISOString(),to:new Date(now - day).toISOString()};
  if(windowName === "week") return {from:new Date(now - 7 * day).toISOString()};
  if(windowName === "month") return {from:new Date(now - 30 * day).toISOString()};
  if(windowName === "year") return {from:new Date(now - 365 * day).toISOString()};
  if(windowName === "all") return {};
  return {from:new Date(now - day).toISOString()};
}
function publicGroupLabel(value){
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g," ").trim().slice(0,180);
}
function publicGroupTitle(value){
  return publicGroupLabel(value).replace(/\b(?:question|update|report|reports|anyone know|is)\b/g," ").replace(/\s+/g," ").trim().slice(0,180);
}
async function publicGroupKey(row){
  const input = `legit-public-group-v2|${publicGroupLabel(row.public_location)}|${publicGroupLabel(row.topic)}|${publicGroupTitle(row.title)}`;
  const digest = await crypto.subtle.digest("SHA-256",new TextEncoder().encode(input));
  return [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2,"0")).join("").slice(0,24);
}
async function publicHappenings(env,url){
  if(!env.DB) throw accessError("Durable public reporting storage is unavailable.",503);
  const range = publicWindow(url.searchParams.get("time") || "today");
  const bindings = [];
  let where = "h.review_state IN ('cleared', 'approved') AND h.public_lat IS NOT NULL AND h.public_lng IS NOT NULL";
  if(range.from){ where += " AND h.created_at >= ?"; bindings.push(range.from); }
  if(range.to){ where += " AND h.created_at < ?"; bindings.push(range.to); }
  const result = await env.DB.prepare(`SELECT h.id,h.title,h.body,h.topic,h.public_location,h.public_lat,h.public_lng,h.balance,h.impact,h.legitimacy_score,h.review_state,h.created_at
    FROM happenings h WHERE ${where} ORDER BY h.created_at DESC LIMIT 500`).bind(...bindings).all();
  const evidenceResult = await env.DB.prepare(`SELECT c.happening_id,e.id,e.evidence_type,e.relationship,e.provenance,e.submitted_at
    FROM evidence e JOIN claims c ON c.id=e.claim_id JOIN happenings h ON h.id=c.happening_id
    WHERE ${where} AND e.review_state IN ('cleared','approved') AND e.provenance IS NOT NULL ORDER BY e.submitted_at DESC LIMIT 1000`).bind(...bindings).all();
  const correctionResult = await env.DB.prepare(`SELECT public_story_id,history_type,summary,created_at
    FROM correction_history WHERE review_state='approved' ORDER BY created_at DESC LIMIT 500`).all();
  const reputationRows = await env.DB.prepare(`SELECT substr(target_id,1,instr(target_id,':')-1) AS group_id,
    SUM(CASE WHEN risk_state='normal' AND points_awarded > 0 THEN 1 ELSE 0 END) AS useful_evidence,
    COUNT(DISTINCT CASE WHEN risk_state='normal' AND points_awarded > 0 THEN actor_fingerprint END) AS independent_assessors,
    SUM(CASE WHEN risk_state='coordination_review' THEN 1 ELSE 0 END) AS coordination_reviews
    FROM reputation_events WHERE action_type='evidence_useful' AND target_id LIKE 'public-%:%' GROUP BY group_id`).all();
  const reputationByGroup = new Map((reputationRows.results || []).map(row => [row.group_id,{usefulEvidence:Number(row.useful_evidence || 0),independentAssessors:Number(row.independent_assessors || 0),coordinationReviews:Number(row.coordination_reviews || 0)}]));
  const grouped = new Map();
  const happeningGroupKeys = new Map();
  for(const row of result.results || []){
    const key = await publicGroupKey(row);
    happeningGroupKeys.set(row.id,key);
    const existing = grouped.get(key);
    if(!existing){
      grouped.set(key,{id:`public-${key}`,title:row.title,body:row.body,topic:row.topic,location:row.public_location,publicLat:Number(row.public_lat),publicLng:Number(row.public_lng),balance:row.balance || "agnostic",impact:Number(row.impact || 1),legitimacyScore:Number(row.legitimacy_score || 0),reports:1,sourceCount:0,createdAt:row.created_at,reviewState:row.review_state,_latTotal:Number(row.public_lat),_lngTotal:Number(row.public_lng),_coordinateCount:1,_sourceKeys:new Set(),_evidenceById:new Map(),corrections:[]});
      continue;
    }
    existing.reports += 1;
    existing._latTotal += Number(row.public_lat || existing.publicLat);
    existing._lngTotal += Number(row.public_lng || existing.publicLng);
    existing._coordinateCount += 1;
    existing.impact = Math.max(existing.impact,Number(row.impact || 1));
    existing.legitimacyScore = Math.round((existing.legitimacyScore * (existing.reports - 1) + Number(row.legitimacy_score || 0)) / existing.reports);
    if(existing.balance !== row.balance) existing.balance = "agnostic";
    if(String(row.created_at) > String(existing.createdAt)) existing.createdAt = row.created_at;
  }
  for(const row of evidenceResult.results || []){
    const item = grouped.get(happeningGroupKeys.get(row.happening_id));
    if(!item) continue;
    const provenance = aggregateSource(row.provenance);
    if(provenance) item._sourceKeys.add(provenance);
    if(item._evidenceById.has(row.id)) continue;
    const relationship = String(row.relationship || "relates");
    item._evidenceById.set(row.id,{id:String(row.id),initials:"EV",title:sanitizeText(row.evidence_type || "Source trail",90),excerpt:`${relationship.charAt(0).toUpperCase()}${relationship.slice(1)} the primary claim.`,provenance:provenance || "Sanitized source trail",submittedAt:row.submitted_at});
  }
  for(const row of correctionResult.results || []){
    const item = [...grouped.values()].find(candidate => candidate.id === row.public_story_id);
    if(item) item.corrections.push({type:row.history_type,summary:sanitizeText(row.summary,500),createdAt:row.created_at});
  }
  for(const [key,item] of grouped){
    const reputation = reputationByGroup.get(item.id) || {usefulEvidence:0,independentAssessors:0,coordinationReviews:0};
    item.publicLat = publicCoordinate(item._latTotal / Math.max(1,item._coordinateCount));
    item.publicLng = publicCoordinate(item._lngTotal / Math.max(1,item._coordinateCount));
    item.sourceCount = item._sourceKeys.size;
    item.evidence = [...item._evidenceById.values()].slice(0,20);
    const sourceBonus = Math.min(20,reputation.independentAssessors * 4 + Math.min(8,item.sourceCount * 3));
    const evidenceBonus = Math.min(10,reputation.usefulEvidence * 2);
    const coordinationPenalty = reputation.coordinationReviews ? 10 : 0;
    item.usefulEvidence = reputation.usefulEvidence;
    item.independentAssessors = reputation.independentAssessors;
    item.coordinationReview = Boolean(reputation.coordinationReviews);
    item.legitimacyScore = Math.max(0,Math.min(100,item.legitimacyScore + sourceBonus + evidenceBonus - coordinationPenalty));
    item.legitimacyBasis = reputation.coordinationReviews
      ? "Distinct approved sources and useful evidence contribute; a coordinated assessment burst is held for review. Report volume alone does not raise legitimacy."
      : "Distinct approved sources and useful evidence contribute; report volume alone does not raise legitimacy.";
    delete item._latTotal;
    delete item._lngTotal;
    delete item._coordinateCount;
    delete item._sourceKeys;
    delete item._evidenceById;
  }
  return {happenings:[...grouped.values()],window:url.searchParams.get("time") || "today",aggregation:"privacy-safe grouping by normalized title, topic, and neighborhood bucket with aggregate coordinates",disclosure:"Only approved, sanitized, neighborhood-level records are public. Identities, exact locations, private media, raw account identifiers, and abuse-control fingerprints are excluded."};
}
function accessError(message,status){ const error = new Error(message); error.status = status; return error; }
function constantTimeEqual(left,right){
  if(left.length !== right.length) return false;
  let difference = 0;
  for(let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}
async function requireModerator(request,env,options={}){
  const configured = String(env.MODERATOR_TOKEN || "");
  if(!configured) throw accessError("Moderator access is not configured on this deployment.",503);
  const header = request.headers.get("authorization") || "";
  const provided = /^Bearer\s+/i.test(header) ? header.replace(/^Bearer\s+/i,"") : "";
  if(!provided || !constantTimeEqual(provided,configured)) throw accessError("Moderator authorization is required.",401);
  const digest = await crypto.subtle.digest("SHA-256",new TextEncoder().encode(provided));
  const fingerprint = [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2,"0")).join("").slice(0,24);
  const allowlist = String(env.MODERATOR_FINGERPRINT_ALLOWLIST || "").split(",").map(value => value.trim()).filter(Boolean);
  if(allowlist.length && !allowlist.includes(fingerprint)) throw accessError("Moderator verification is not active for this credential.",403);
  const verificationSecret = String(env.MODERATOR_VERIFICATION_SECRET || "");
  const providedVerification = request.headers.get("x-moderator-verification") || "";
  if(verificationSecret && (!providedVerification || !constantTimeEqual(providedVerification,verificationSecret))) throw accessError("Additional moderator verification is required.",401);
  const verificationLevel = verificationSecret ? "token_and_secret" : "token";
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  if(options.record !== false && env.DB){
    await env.DB.prepare("INSERT INTO moderator_verification_events (id,moderator_fingerprint,verification_level,created_at,expires_at) VALUES (?,?,?,?,?)").bind(crypto.randomUUID(),fingerprint,verificationLevel,new Date().toISOString(),expiresAt).run();
  }
  return {fingerprint,verificationLevel,expiresAt};
}
async function completeModeratorTask(env,taskType,targetId,moderatorFingerprint,decision,completedAt){
  if(!env.DB) return null;
  const current = await env.DB.prepare("SELECT id,claimed_at FROM moderator_tasks WHERE task_type=? AND target_id=? AND moderator_fingerprint=? AND status='claimed' ORDER BY claimed_at DESC LIMIT 1").bind(taskType,targetId,moderatorFingerprint).first();
  const claimedAt = current?.claimed_at || completedAt;
  const responseSeconds = Math.max(0,Math.round((Date.parse(completedAt) - Date.parse(claimedAt)) / 1000));
  if(current){
    await env.DB.prepare("UPDATE moderator_tasks SET status='completed',completed_at=?,response_seconds=?,completed_decision=? WHERE id=?").bind(completedAt,responseSeconds,decision,current.id).run();
    return {taskId:current.id,responseSeconds};
  }
  const taskId = crypto.randomUUID();
  await env.DB.prepare("INSERT INTO moderator_tasks (id,task_type,target_id,moderator_fingerprint,status,claimed_at,completed_at,response_seconds,completed_decision) VALUES (?,?,?,?,?,?,?,?,?)").bind(taskId,taskType,targetId,moderatorFingerprint,"completed",completedAt,completedAt,0,decision).run();
  return {taskId,responseSeconds:0};
}
async function moderationTask(env,request,input){
  const moderator = await requireModerator(request,env);
  if(!env.DB) throw accessError("Durable moderation storage is unavailable.",503);
  const taskType = requireText(input.taskType,"A task type",30);
  if(!["happening","report","privacy_request","coordination"].includes(taskType)) throw new Error("This moderation task type is not supported.");
  const targetId = requireText(input.targetId,"A task target",160);
  const action = requireText(input.action || "claim","A task action",20);
  if(!["claim","release"].includes(action)) throw new Error("Task action must be claim or release.");
  const active = await env.DB.prepare("SELECT id,moderator_fingerprint,claimed_at FROM moderator_tasks WHERE task_type=? AND target_id=? AND status='claimed' ORDER BY claimed_at DESC LIMIT 1").bind(taskType,targetId).first();
  if(action === "claim"){
    if(active && active.moderator_fingerprint !== moderator.fingerprint) throw accessError("This task is already claimed by another moderator.",409);
    if(active) return {taskId:active.id,status:"claimed",claimedAt:active.claimed_at,verificationLevel:moderator.verificationLevel};
    const claimedAt = new Date().toISOString();
    const taskId = crypto.randomUUID();
    await env.DB.prepare("INSERT INTO moderator_tasks (id,task_type,target_id,moderator_fingerprint,status,claimed_at) VALUES (?,?,?,?,?,?)").bind(taskId,taskType,targetId,moderator.fingerprint,"claimed",claimedAt).run();
    return {taskId,status:"claimed",claimedAt,verificationLevel:moderator.verificationLevel};
  }
  if(!active || active.moderator_fingerprint !== moderator.fingerprint) throw accessError("This task is not claimed by this moderator.",409);
  await env.DB.prepare("UPDATE moderator_tasks SET status='released',completed_at=? WHERE id=?").bind(new Date().toISOString(),active.id).run();
  return {taskId:active.id,status:"released"};
}
async function moderatorQuality(env,request,input){
  const moderator = await requireModerator(request,env);
  if(!env.DB) throw accessError("Durable moderation storage is unavailable.",503);
  const decisionId = requireText(input.decisionId,"A moderation decision",120);
  const outcome = requireText(input.outcome,"A quality outcome",20);
  if(!["upheld","reversed","inconclusive"].includes(outcome)) throw new Error("Quality outcome must be upheld, reversed, or inconclusive.");
  const basis = requireText(input.basis,"A quality basis",1000);
  const decision = await env.DB.prepare("SELECT id,decision,moderator_fingerprint FROM moderation_decisions WHERE id=? LIMIT 1").bind(decisionId).first();
  if(!decision) throw new Error("Moderation decision was not found.");
  if(decision.moderator_fingerprint === moderator.fingerprint) throw accessError("A moderator cannot quality-review their own decision.",403);
  const existing = await env.DB.prepare("SELECT id FROM moderator_quality_events WHERE decision_id=? LIMIT 1").bind(decisionId).first();
  if(existing) return {accepted:false,reason:"This decision already has a quality review."};
  await env.DB.prepare("INSERT INTO moderator_quality_events (id,decision_id,outcome,basis,reviewer_fingerprint,created_at) VALUES (?,?,?,?,?,?)").bind(crypto.randomUUID(),decisionId,outcome,basis,moderator.fingerprint,new Date().toISOString()).run();
  return {accepted:true,outcome,illegitimateBounce:outcome === "reversed" && ["hold","flag"].includes(decision.decision)};
}
async function moderatorMetrics(env,request,url){
  const moderator = await requireModerator(request,env,{record:false});
  if(!env.DB) throw accessError("Durable moderation storage is unavailable.",503);
  const requestedDays = Number(url.searchParams.get("days") || 30);
  const days = Number.isFinite(requestedDays) ? Math.min(90,Math.max(1,Math.floor(requestedDays))) : 30;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const [assigned,completed,avgResponse,decisions,bounces,team,daily] = await Promise.all([
    env.DB.prepare("SELECT COUNT(*) AS total FROM moderator_tasks WHERE moderator_fingerprint=? AND claimed_at>=?").bind(moderator.fingerprint,since).first(),
    env.DB.prepare("SELECT COUNT(*) AS total FROM moderator_tasks WHERE moderator_fingerprint=? AND status='completed' AND completed_at>=?").bind(moderator.fingerprint,since).first(),
    env.DB.prepare("SELECT AVG(response_seconds) AS average FROM moderator_tasks WHERE moderator_fingerprint=? AND status='completed' AND completed_at>=?").bind(moderator.fingerprint,since).first(),
    env.DB.prepare("SELECT COUNT(*) AS total FROM moderation_decisions WHERE moderator_fingerprint=? AND created_at>=?").bind(moderator.fingerprint,since).first(),
    env.DB.prepare("SELECT COUNT(*) AS total FROM moderator_quality_events q JOIN moderation_decisions d ON d.id=q.decision_id WHERE d.moderator_fingerprint=? AND q.outcome='reversed' AND d.decision IN ('hold','flag') AND q.created_at>=?").bind(moderator.fingerprint,since).first(),
    env.DB.prepare("SELECT COUNT(DISTINCT moderator_fingerprint) AS moderators, COUNT(*) AS decisions FROM moderation_decisions WHERE created_at>=?").bind(since).first(),
    env.DB.prepare("SELECT substr(d.created_at,1,10) AS day, COUNT(*) AS decisions, SUM(CASE WHEN q.outcome='reversed' AND d.decision IN ('hold','flag') THEN 1 ELSE 0 END) AS illegitimate_bounces FROM moderation_decisions d LEFT JOIN moderator_quality_events q ON q.decision_id=d.id WHERE d.created_at>=? GROUP BY substr(d.created_at,1,10) ORDER BY day ASC").bind(since).all()
  ]);
  return {
    window:{days,since},
    verification:{level:moderator.verificationLevel,expiresAt:moderator.expiresAt},
    yourMetrics:{tasksAssigned:Number(assigned?.total || 0),tasksCompleted:Number(completed?.total || 0),decisions:Number(decisions?.total || 0),averageResponseMinutes:Math.round((Number(avgResponse?.average || 0) / 60) * 10) / 10,illegitimateBounces:Number(bounces?.total || 0)},
    teamMetrics:{activeModerators:Number(team?.moderators || 0),decisions:Number(team?.decisions || 0)},
    daily:(daily?.results || []).map(row=>({day:row.day,decisions:Number(row.decisions || 0),illegitimateBounces:Number(row.illegitimate_bounces || 0)})),
    anonymity:{publicModeratorIdentity:"never disclosed",stablePublicAlias:"none",storedIdentity:"one-way credential fingerprint only",operatorNote:"The public API never returns moderator identifiers. Hosting and security logs remain controlled by the service operator."}
  };
}
async function moderationQueue(env,request){
  await requireModerator(request,env);
  if(!env.DB) throw accessError("Durable moderation storage is unavailable.",503);
  const result = await env.DB.prepare(`SELECT id,title,body,topic,public_location,public_lat,public_lng,location_precision,identity_visibility,identity_display,impact,balance,legitimacy_score,review_state,attachment_state,attachment_count,created_at,retention_until FROM happenings WHERE review_state='pending' ORDER BY created_at ASC LIMIT 50`).all();
  const privacyRequests = await env.DB.prepare(`SELECT id,request_type,details,status,resolution,resolved_at,created_at FROM privacy_requests WHERE status='pending' ORDER BY created_at ASC LIMIT 50`).all();
  const reports = await env.DB.prepare(`SELECT id,target_type,target_id,reason,details,review_state,created_at FROM moderation_reports WHERE review_state='pending' ORDER BY created_at ASC LIMIT 50`).all();
  const coordination = await env.DB.prepare(`SELECT target_id,COUNT(*) AS total FROM reputation_events WHERE risk_state='coordination_review' GROUP BY target_id ORDER BY total DESC LIMIT 50`).all();
  return {queue:result.results || [],privacyRequests:privacyRequests.results || [],reports:reports.results || [],coordinationReviews:coordination.results || [],limit:50,disclosure:"Moderator-only queue. Do not copy private identity or exact-location fields into public notes."};
}
async function recordPrivacyRequestAction(env,request,input){
  const moderator = await requireModerator(request,env);
  const moderatorFingerprint = moderator.fingerprint;
  if(!env.DB) throw accessError("Durable privacy storage is unavailable.",503);
  await ensurePrivacySchema(env);
  const requestId = requireText(input.requestId,"A privacy request",120);
  const status = requireText(input.status || "resolved","A privacy request status",20);
  if(!["pending","resolved"].includes(status)) throw new Error("Privacy request status must be pending or resolved.");
  const resolution = status === "resolved" ? requireText(input.resolution,"A resolution",1000) : sanitizeText(input.resolution,1000);
  const current = await env.DB.prepare("SELECT id FROM privacy_requests WHERE id=? LIMIT 1").bind(requestId).first();
  if(!current) throw new Error("Privacy request was not found.");
  const resolvedAt = status === "resolved" ? new Date().toISOString() : null;
  await env.DB.prepare("UPDATE privacy_requests SET status=?,resolution=?,resolved_at=?,resolved_by_fingerprint=? WHERE id=?").bind(status,resolution || null,resolvedAt,status === "resolved" ? moderatorFingerprint : null,requestId).run();
  await completeModeratorTask(env,"privacy_request",requestId,moderatorFingerprint,status,resolvedAt || new Date().toISOString());
  return {requestId,status,resolvedAt};
}
async function recordModerationAction(env,request,input){
  const moderator = await requireModerator(request,env);
  const moderatorFingerprint = moderator.fingerprint;
  if(!env.DB) throw accessError("Durable moderation storage is unavailable.",503);
  const happeningId = requireText(input.happeningId,"A happening",120);
  const decision = requireText(input.decision,"A moderation decision",20);
  if(!["approve","hold","flag"].includes(decision)) throw new Error("Decision must be approve, hold, or flag.");
  const reason = requireText(input.reason,"A moderation reason",500);
  const current = await env.DB.prepare(`SELECT id FROM happenings WHERE id=? LIMIT 1`).bind(happeningId).first();
  if(!current) throw new Error("Happening was not found.");
  const reviewState = decision === "approve" ? "cleared" : decision === "flag" ? "flagged" : "pending";
  const createdAt = new Date().toISOString();
  await env.DB.batch([
    env.DB.prepare(`UPDATE happenings SET review_state=? WHERE id=?`).bind(reviewState,happeningId),
    env.DB.prepare(`INSERT INTO moderation_decisions (id,happening_id,decision,reason,moderator_fingerprint,created_at) VALUES (?,?,?,?,?,?)`).bind(crypto.randomUUID(),happeningId,decision,reason,moderatorFingerprint,createdAt)
  ]);
  await completeModeratorTask(env,"happening",happeningId,moderatorFingerprint,decision,createdAt);
  return {happeningId,decision,reviewState,createdAt};
}
async function recordReportAction(env,request,input){
  const moderator = await requireModerator(request,env);
  const moderatorFingerprint = moderator.fingerprint;
  if(!env.DB) throw accessError("Durable moderation storage is unavailable.",503);
  const reportId = requireText(input.reportId,"A moderation report",120);
  const status = requireText(input.status || "resolved","A report status",20);
  if(!["pending","resolved","rejected"].includes(status)) throw new Error("Report status must be pending, resolved, or rejected.");
  const resolution = status === "pending" ? sanitizeText(input.resolution,1000) : requireText(input.resolution,"A resolution",1000);
  const current = await env.DB.prepare(`SELECT id,target_type,target_id,reason,details FROM moderation_reports WHERE id=? LIMIT 1`).bind(reportId).first();
  if(!current) throw new Error("Moderation report was not found.");
  const reviewState = status === "resolved" ? "cleared" : status === "rejected" ? "flagged" : "pending";
  const resolvedAt = status === "pending" ? null : new Date().toISOString();
  await env.DB.prepare("UPDATE moderation_reports SET review_state=?,resolution=?,resolved_at=?,resolved_by_fingerprint=? WHERE id=?").bind(reviewState,resolution || null,resolvedAt,status === "pending" ? null : moderatorFingerprint,reportId).run();
  if(status === "resolved" && (current.reason === "correction" || current.reason === "appeal") && String(current.target_id).startsWith("public-")){
    await env.DB.prepare("INSERT INTO correction_history (id,history_type,public_story_id,summary,review_state,created_at,resolved_at,resolved_by_fingerprint) VALUES (?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(),current.reason,current.target_id,resolution,"approved",new Date().toISOString(),resolvedAt,moderatorFingerprint).run();
  }
  await completeModeratorTask(env,"report",reportId,moderatorFingerprint,status,resolvedAt || new Date().toISOString());
  return {reportId,status,reviewState,resolvedAt};
}
async function deskItems(env,request){
  const key = await ownerKey(request);
  if(!env.DB) throw accessError("Durable desk storage is unavailable.",503);
  const rows = await env.DB.prepare("SELECT happening_key,created_at FROM desk_items WHERE owner_key=? ORDER BY created_at DESC LIMIT 500").bind(key).all();
  return {authenticated:true,items:rows.results || []};
}
async function saveDeskItem(env,request,input){
  const key = await ownerKey(request);
  if(!env.DB) throw accessError("Durable desk storage is unavailable.",503);
  const happeningKey = requireText(input.happeningKey,"A desk item",180);
  const action = input.action === "remove" ? "remove" : "save";
  if(action === "remove"){
    await env.DB.prepare("DELETE FROM desk_items WHERE owner_key=? AND happening_key=?").bind(key,happeningKey).run();
    return {saved:false,happeningKey};
  }
  await env.DB.prepare("INSERT OR IGNORE INTO desk_items (id,owner_key,happening_key,created_at) VALUES (?,?,?,?)").bind(crypto.randomUUID(),key,happeningKey,new Date().toISOString()).run();
  return {saved:true,happeningKey};
}
async function privacyProfile(env,request){
  const key = await ownerKey(request);
  await ensurePrivacySchema(env);
  const preference = await env.DB.prepare("SELECT opt_out_sharing,limit_sensitive,updated_at FROM privacy_preferences WHERE owner_key=? LIMIT 1").bind(key).first();
  const summary = await env.DB.prepare("SELECT COUNT(*) AS total, SUM(CASE WHEN review_state='pending' THEN 1 ELSE 0 END) AS pending FROM happenings WHERE owner_key=?").bind(key).first();
  const reputation = await env.DB.prepare("SELECT COUNT(*) AS total FROM reputation_events WHERE owner_key=?").bind(key).first();
  const desk = await env.DB.prepare("SELECT COUNT(*) AS total FROM desk_items WHERE owner_key=?").bind(key).first();
  return {authenticated:true,controls:{aggregateOnly:true,optOutSharing:true,limitSensitive:preference ? Boolean(preference.limit_sensitive) : true,updatedAt:preference?.updated_at || null},dataSummary:{happenings:Number(summary?.total || 0),pending:Number(summary?.pending || 0),reputationEvents:Number(reputation?.total || 0),deskItems:Number(desk?.total || 0)},disclosure:"Only sanitized, neighborhood-level records linked to this signed-in profile are included. Legit never sells or shares personal information. Anonymous contributions and anonymous abuse-prevention fingerprints are not linked to a profile."};
}
async function exportPrivacyData(env,request){
  const key = await ownerKey(request);
  await ensurePrivacySchema(env);
  const preferences = await env.DB.prepare("SELECT opt_out_sharing,limit_sensitive,updated_at FROM privacy_preferences WHERE owner_key=? LIMIT 1").bind(key).first();
  const happenings = await env.DB.prepare("SELECT id,title,body,topic,public_location,public_lat,public_lng,location_precision,identity_visibility,impact,balance,legitimacy_score,review_state,attachment_state,attachment_count,created_at,retention_until FROM happenings WHERE owner_key=? ORDER BY created_at ASC").bind(key).all();
  const claims = await env.DB.prepare("SELECT c.id,c.happening_id,c.text,c.status,c.attribution,c.created_at FROM claims c JOIN happenings h ON h.id=c.happening_id WHERE h.owner_key=? ORDER BY c.created_at ASC").bind(key).all();
  const evidence = await env.DB.prepare("SELECT e.id,e.claim_id,e.evidence_type,e.relationship,e.provenance,e.review_state,e.submitted_at FROM evidence e JOIN claims c ON c.id=e.claim_id JOIN happenings h ON h.id=c.happening_id WHERE h.owner_key=? ORDER BY e.submitted_at ASC").bind(key).all();
  const requests = await env.DB.prepare("SELECT id,request_type,details,status,resolution,resolved_at,created_at FROM privacy_requests WHERE owner_key=? ORDER BY created_at ASC").bind(key).all();
  const reputation = await env.DB.prepare("SELECT id,action_type,target_id,action_day,points_awarded,basis,created_at FROM reputation_events WHERE owner_key=? ORDER BY created_at ASC").bind(key).all();
  const desk = await env.DB.prepare("SELECT happening_key,created_at FROM desk_items WHERE owner_key=? ORDER BY created_at ASC").bind(key).all();
  return {exportedAt:new Date().toISOString(),storageModel:"sanitized-with-neighborhood-aggregation",preferences:preferences || {opt_out_sharing:1,limit_sensitive:1},happenings:happenings.results || [],claims:claims.results || [],evidence:evidence.results || [],privacyRequests:requests.results || [],reputationEvents:reputation.results || [],deskItems:desk.results || []};
}
async function savePrivacyPreferences(env,request,input){
  const key = await ownerKey(request);
  await ensurePrivacySchema(env);
  const updatedAt = new Date().toISOString();
  const optOutSharing = input.optOutSharing === false ? 0 : 1;
  const limitSensitive = input.limitSensitive === false ? 0 : 1;
  await env.DB.batch([env.DB.prepare("DELETE FROM privacy_preferences WHERE owner_key=?").bind(key),env.DB.prepare("INSERT INTO privacy_preferences (owner_key,opt_out_sharing,limit_sensitive,updated_at) VALUES (?,?,?,?)").bind(key,optOutSharing,limitSensitive,updatedAt)]);
  return {optOutSharing:Boolean(optOutSharing),limitSensitive:Boolean(limitSensitive),updatedAt};
}
async function saveCorrectionRequest(env,request,input){
  const key = await ownerKey(request);
  await ensurePrivacySchema(env);
  const details = requireText(input.details,"A correction request",1000);
  const createdAt = new Date().toISOString();
  await env.DB.prepare("INSERT INTO privacy_requests (id,owner_key,request_type,details,status,created_at) VALUES (?,?,?,?,?,?)").bind(crypto.randomUUID(),key,"correction",details,"pending",createdAt).run();
  return {status:"pending",createdAt};
}
async function deleteAllProfileData(env,request){
  const key = await ownerKey(request);
  await ensurePrivacySchema(env);
  const summary = await env.DB.prepare("SELECT COUNT(*) AS total FROM happenings WHERE owner_key=?").bind(key).first();
  const reputation = await env.DB.prepare("SELECT COUNT(*) AS total FROM reputation_events WHERE owner_key=?").bind(key).first();
  const deletedHappenings = Number(summary?.total || 0);
  const deletedReputationEvents = Number(reputation?.total || 0);
  await env.DB.batch([
    env.DB.prepare("DELETE FROM moderation_reports WHERE reporter_owner_key=? OR target_id IN (SELECT id FROM happenings WHERE owner_key=?) OR target_id IN (SELECT id FROM claims WHERE happening_id IN (SELECT id FROM happenings WHERE owner_key=?)) OR target_id IN (SELECT id FROM evidence WHERE claim_id IN (SELECT id FROM claims WHERE happening_id IN (SELECT id FROM happenings WHERE owner_key=?)))").bind(key,key,key,key),
    env.DB.prepare("DELETE FROM evidence WHERE claim_id IN (SELECT id FROM claims WHERE happening_id IN (SELECT id FROM happenings WHERE owner_key=?))").bind(key),
    env.DB.prepare("DELETE FROM moderation_decisions WHERE happening_id IN (SELECT id FROM happenings WHERE owner_key=?)").bind(key),
    env.DB.prepare("DELETE FROM claims WHERE happening_id IN (SELECT id FROM happenings WHERE owner_key=?)").bind(key),
    env.DB.prepare("DELETE FROM reputation_events WHERE owner_key=?").bind(key),
    env.DB.prepare("DELETE FROM desk_items WHERE owner_key=?").bind(key),
    env.DB.prepare("DELETE FROM happenings WHERE owner_key=?").bind(key),
    env.DB.prepare("DELETE FROM privacy_requests WHERE owner_key=?").bind(key),
    env.DB.prepare("DELETE FROM privacy_preferences WHERE owner_key=?").bind(key),
    env.DB.prepare("INSERT INTO privacy_deletion_audit (id,scope,deleted_happenings,deleted_reputation_events,created_at) VALUES (?,?,?,?,?)").bind(crypto.randomUUID(),"profile",deletedHappenings,deletedReputationEvents,new Date().toISOString())
  ]);
  return {deletedHappenings,deletedReputationEvents,deletedAt:new Date().toISOString()};
}
async function handleApi(request,env,ctx){
  const url = new URL(request.url);
  scheduleRetentionCleanup(env,ctx);
  if(request.method === "OPTIONS") return new Response(null,{status:204,headers:{...securityHeaders,"allow":"GET, POST, OPTIONS"}});
  if(!["GET","POST"].includes(request.method)) return jsonResponse({error:"Method not allowed."},405,{allow:"GET, POST, OPTIONS"});
  if(request.method === "POST"){
    const origin = request.headers.get("origin");
    const fetchSite = request.headers.get("sec-fetch-site");
    if(origin){ try { if(new URL(origin).origin !== url.origin) return jsonResponse({error:"Cross-origin mutations are not accepted."},403); } catch { return jsonResponse({error:"Invalid request origin."},403); } }
    if(fetchSite && !["same-origin","same-site","none"].includes(fetchSite)) return jsonResponse({error:"Cross-site mutations are not accepted."},403);
    if(!(await allowRequest(request,url.pathname))) return jsonResponse({error:"Please wait before sending another report."},429,{"retry-after":"60"});
    if(!(await allowDurableRequest(env,request,url.pathname))) return jsonResponse({error:"This action is temporarily rate-limited. Please try again later."},429,{"retry-after":"60"});
  }
  if(url.pathname === "/api/health" && request.method === "GET") return jsonResponse({ok:true,policyVersion:policy.version});
  if(url.pathname === "/api/policy" && request.method === "GET") return jsonResponse(policy);
  if(url.pathname === "/api/reputation/policy" && request.method === "GET") return jsonResponse(reputationRules);
  if(url.pathname === "/api/profile/privacy" && request.method === "GET"){
    try { return jsonResponse(await privacyProfile(env,request)); }
    catch(error){ return jsonResponse({error:error.message || "Privacy controls are unavailable."},error.status || (error.message === "Durable privacy storage is unavailable." ? 503 : 400)); }
  }
  if(url.pathname === "/api/profile/privacy/export" && request.method === "GET"){
    try { return jsonResponse(await exportPrivacyData(env,request),200,{"content-disposition":"attachment; filename=legit-data-export.json"}); }
    catch(error){ return jsonResponse({error:error.message || "Data export is unavailable."},error.status || (error.message === "Durable privacy storage is unavailable." ? 503 : 400)); }
  }
  if(url.pathname === "/api/profile/privacy" && request.method === "POST"){
    try { const input=await readJson(request); if(input.action === "save_preferences") return jsonResponse({ok:true,controls:await savePrivacyPreferences(env,request,input)},200); if(input.action === "correction_request") return jsonResponse({ok:true,request:await saveCorrectionRequest(env,request,input)},202); if(input.action === "delete_all") return jsonResponse({ok:true,deletion:await deleteAllProfileData(env,request)},200); throw new Error("This privacy action is not supported."); }
    catch(error){ return jsonResponse({error:error.message || "Privacy action was rejected."},error.status || (error.message === "Durable privacy storage is unavailable." ? 503 : 400)); }
  }
  if(url.pathname === "/api/desk" && request.method === "GET"){
    try { return jsonResponse(await deskItems(env,request)); }
    catch(error){ return jsonResponse({error:error.message || "Desk data is unavailable."},error.status || (error.message === "Durable desk storage is unavailable." ? 503 : 400)); }
  }
  if(url.pathname === "/api/desk" && request.method === "POST"){
    try { return jsonResponse({ok:true,desk:await saveDeskItem(env,request,await readJson(request))},200); }
    catch(error){ return jsonResponse({error:error.message || "Desk item could not be saved."},error.status || (error.message === "Durable desk storage is unavailable." ? 503 : 400)); }
  }
  if(url.pathname === "/api/moderation/status" && request.method === "GET"){
    try { return jsonResponse(await moderationStatus(env)); }
    catch(error){ return jsonResponse({error:error.message || "Moderation status is unavailable."},error.message === "Durable moderation storage is unavailable." ? 503 : 400); }
  }
  if(url.pathname === "/api/moderation/verify" && request.method === "POST"){
    try { const moderator = await requireModerator(request,env); return jsonResponse({verified:true,verificationLevel:moderator.verificationLevel,expiresAt:moderator.expiresAt,publicIdentity:"anonymous"}); }
    catch(error){ return jsonResponse({error:error.message || "Moderator verification failed."},error.status || 401); }
  }
  if(url.pathname === "/api/moderation/metrics" && request.method === "GET"){
    try { return jsonResponse(await moderatorMetrics(env,request,url)); }
    catch(error){ return jsonResponse({error:error.message || "Moderator metrics are unavailable."},error.status || 400); }
  }
  if(url.pathname === "/api/moderation/tasks" && request.method === "POST"){
    try { return jsonResponse({ok:true,task:await moderationTask(env,request,await readJson(request))},200); }
    catch(error){ return jsonResponse({error:error.message || "Moderator task action was rejected."},error.status || 400); }
  }
  if(url.pathname === "/api/moderation/quality" && request.method === "POST"){
    try { return jsonResponse({ok:true,review:await moderatorQuality(env,request,await readJson(request))},202); }
    catch(error){ return jsonResponse({error:error.message || "Moderator quality review was rejected."},error.status || 400); }
  }
  if(url.pathname === "/api/happenings" && request.method === "GET"){
    try { return jsonResponse(await publicHappenings(env,url),200,{"cache-control":"public, max-age=15, s-maxage=15"}); }
    catch(error){ return jsonResponse({error:error.message || "Public happenings are unavailable."},error.status || (error.message === "Durable public reporting storage is unavailable." ? 503 : 400)); }
  }
  if(url.pathname === "/api/moderation/queue" && request.method === "GET"){
    try { return jsonResponse(await moderationQueue(env,request)); }
    catch(error){ return jsonResponse({error:error.message || "Moderator queue is unavailable."},error.status || 400); }
  }
  if(url.pathname === "/api/moderation/actions" && request.method === "POST"){
    try { const input=await readJson(request); const action=input.actionType === "privacy_request" ? await recordPrivacyRequestAction(env,request,input) : input.actionType === "moderation_report" ? await recordReportAction(env,request,input) : await recordModerationAction(env,request,input); return jsonResponse({ok:true,action},202); }
    catch(error){ return jsonResponse({error:error.message || "Moderation action was rejected."},error.status || (error.message === "Durable moderation storage is unavailable." ? 503 : 400)); }
  }
  if(url.pathname === "/api/happenings" && request.method === "POST"){
    try { const item = normalizeHappening(await readJson(request)); await persistHappening(env,item,request); return jsonResponse({ok:true,happening:{id:item.id,publicLat:item.publicLat,publicLng:item.publicLng,locationPrecision:item.locationPrecision,identityVisibility:item.identityVisibility,reviewState:item.reviewState,attachmentState:item.attachmentState}},202); }
    catch(error){ return jsonResponse({error:error.message || "Submission was rejected by the privacy gate."},error.status || (error.message === "Durable moderation storage is unavailable." ? 503 : 400)); }
  }
  if(url.pathname === "/api/reports" && request.method === "POST"){
    try { return jsonResponse({ok:true,report:await persistReport(env,await readJson(request),request)},202); }
    catch(error){ return jsonResponse({error:error.message || "Report was rejected."},error.status || (error.message === "Durable moderation storage is unavailable." ? 503 : 400)); }
  }
  if(url.pathname === "/api/reputation/assessment" && request.method === "POST"){
    try { return jsonResponse({ok:true,assessment:await persistAssessment(env,request,await readJson(request))},202); }
    catch(error){ return jsonResponse({error:error.message || "Assessment was rejected."},error.status || (error.message === "Durable reputation storage is unavailable." ? 503 : 400)); }
  }
  return jsonResponse({error:"Not found"},404);
}
function assetResponse(pathname){
  const key = pathname === "/" ? "index.html" : pathname.replace(/^\//,"");
  const asset = ASSET_BUNDLE[key];
  if(!asset) return null;
  return textResponse(asset.body,asset.type);
}

export default {
  async fetch(request,env,ctx){
    const url = new URL(request.url);
    if(url.pathname.startsWith("/api/")) return handleApi(request,env,ctx);
    return assetResponse(url.pathname) || textResponse("Not found","text/plain; charset=utf-8");
  },
  async scheduled(_controller,env){
    await purgeExpiredRecords(env);
  }
};
