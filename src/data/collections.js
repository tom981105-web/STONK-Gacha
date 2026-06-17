export const GRADE_ORDER = ["Common", "Rare", "Epic", "Legendary", "Mythic"];
export const TYPE_ORDER = ["Skin", "Frame", "Effect", "Theme"];

const skinItems = [
  ["skin-gold-chart", "Gold Chart Skin", "Common", "GC", "A polished chart surface with warm gold candle edges.", "Even a tiny gain deserves a little shine.", "Applies gold linework to chart panels."],
  ["skin-neon-ticker", "Neon Ticker Skin", "Common", "NT", "A clean ticker skin with soft cyan market glow.", "The ticker keeps blinking after midnight.", "Adds neon edges to ticker modules."],
  ["skin-blackmarket-ticker", "Black Market Ticker Skin", "Rare", "BM", "A private exchange terminal skin with dark scanlines.", "Quotes travel quieter in the back room.", "Adds black market scanlines to ticker panels."],
  ["skin-glitch-chart", "Glitch Chart Skin", "Epic", "GL", "A chart skin that fractures during hard moves.", "The market is not broken. It is transmitting.", "Adds glitch trails to volatile chart movement."],
  ["skin-ice-bidbook", "Ice Bidbook Skin", "Common", "IB", "A cold glass bidbook layout for calmer reading.", "Cool hands make better entries.", "Adds ice-blue highlights to bid and ask rows."],
  ["skin-redline-loss", "Redline Loss Skin", "Rare", "RL", "A warning-focused skin for loss zones and risk bands.", "The line was there before the excuse.", "Highlights loss zones with redline marks."],
  ["skin-circuit-candle", "Circuit Candle Skin", "Epic", "CC", "Candles with fine circuit traces and algorithmic shine.", "Even instinct leaves a circuit trace.", "Adds circuit patterns to candle bodies."],
  ["skin-liquid-neon", "Liquid Neon Skin", "Legendary", "LN", "A flowing neon treatment for profit curves and panels.", "Money does not freeze. It flows.", "Animates profit curves with liquid neon."],
  ["skin-void-terminal", "Void Terminal Skin", "Mythic", "VT", "A black terminal skin where prices rise out of the void.", "When the quote disappears, the trade has begun.", "Transforms trading panels into a void terminal."],
  ["skin-carbon-ledger", "Carbon Ledger Skin", "Common", "CL", "A carbon-textured ledger surface for archive cards.", "Light in weight, heavy in records.", "Adds carbon texture to collection cards."],
  ["skin-plasma-index", "Plasma Index Skin", "Legendary", "PI", "A market index skin rendered as plasma pressure waves.", "An index is weather wearing numbers.", "Adds plasma wave motion to index panels."],
  ["skin-ghost-order", "Ghost Order Skin", "Epic", "GO", "Order shadows pass through before fills appear.", "Someone clicked first. Everyone saw later.", "Adds ghost trails to order events."],
  ["skin-casino-tick", "Casino Tick Skin", "Rare", "CT", "Ticker ticks flash like a private casino display.", "The table never closes when the candles move.", "Adds casino-style tick flashes."],
  ["skin-vip-quote", "VIP Quote Skin", "Legendary", "VQ", "A premium quote panel with black gold trim.", "Some quotes arrive behind a velvet rope.", "Applies VIP trim to quote panels."],
  ["skin-chrome-candle", "Chrome Candle Skin", "Rare", "CH", "Mirror-finished candles for high-contrast sessions.", "Reflections look sharper in a volatile room.", "Adds chrome finish to candle charts."],
  ["skin-night-ipo", "Night IPO Skin", "Epic", "NI", "A new-listing skin with midnight launch lighting.", "The bell rings best when nobody sleeps.", "Adds IPO launch lighting to new entries."],
  ["skin-dark-pool-panel", "Dark Pool Panel Skin", "Legendary", "DP", "A hidden-liquidity panel with submerged quote bands.", "Depth is quiet until it moves.", "Adds dark pool bands to market panels."],
  ["skin-hologram-ledger", "Hologram Ledger Skin", "Epic", "HL", "A transparent ledger skin with layered hologram rows.", "The numbers float because the risk is real.", "Adds hologram rows to ledger views."],
  ["skin-margin-heatmap", "Margin Heatmap Skin", "Rare", "MH", "A pressure map for leverage-heavy sessions.", "Heat is useful until it becomes the room.", "Adds margin heat overlays to panels."],
  ["skin-emerald-volume", "Emerald Volume Skin", "Common", "EV", "A volume skin with clean emerald columns.", "Volume speaks before price admits it.", "Colors volume columns with emerald glow."],
  ["skin-solar-close", "Solar Close Skin", "Legendary", "SC", "A closing-session skin with gold solar flares.", "The last candle still wants the spotlight.", "Adds solar flares to close-session UI."],
  ["skin-singularity-tape", "Singularity Tape Skin", "Mythic", "ST", "A time-and-sales skin pulled into a single bright point.", "All prints bend toward the same impossible quote.", "Turns tape flow into a singularity stream."]
];

const frameItems = [
  ["frame-retail-glow", "Retail Glow Frame", "Common", "RG", "A compact frame for small accounts with stubborn light.", "Small hands still press real buttons.", "Adds a soft gold profile edge."],
  ["frame-scalper-pulse", "Scalper Pulse Frame", "Rare", "SP", "A fast pulse frame built around rapid entries.", "The wait is long. The click is short.", "Adds quick sweep light to the frame."],
  ["frame-black-vip", "Black VIP Frame", "Legendary", "BV", "A heavy black gold frame for private exchange clients.", "The door is closed because the name is already inside.", "Adds black gold pulse to profile edges."],
  ["frame-neon-trader", "Neon Trader Frame", "Rare", "TR", "A cyan frame for traders who live in the late session.", "Sleep fades. The stop line stays bright.", "Adds cyan neon loop to profile edges."],
  ["frame-margin-alert", "Margin Alert Frame", "Epic", "MA", "A profile frame wrapped in red warning rails.", "The warning arrived before the order did.", "Adds alert flashes to frame corners."],
  ["frame-emerald-floor", "Emerald Floor Frame", "Common", "EF", "A frame inspired by the cold light of an exchange floor.", "Prices move under your feet too.", "Adds emerald floor glow to the lower edge."],
  ["frame-quant-halo", "Quant Halo Frame", "Epic", "QH", "A circular frame of formulas and signal fragments.", "Drop the feeling. Tighten the error.", "Adds rotating quant rings around profiles."],
  ["frame-otc-courier", "OTC Courier Frame", "Rare", "OC", "A sealed frame for off-market message routes.", "Footprints remain outside regular hours.", "Adds a sealed OTC mark to the side edge."],
  ["frame-crown-circuit", "Crown Circuit Frame", "Legendary", "CR", "A crown-shaped circuit frame for dominant sessions.", "The top is quiet. The circuit is not.", "Lights a crown circuit above the profile."],
  ["frame-singularity-vault", "Singularity Vault Frame", "Mythic", "SV", "A vault-door frame that turns like sealed capital.", "No key. Only balance.", "Adds rotating vault-door motion to the frame."],
  ["frame-copper-pit", "Copper Pit Frame", "Common", "CP", "A copper-trim frame from an old exchange pit.", "Old rails can still carry fresh fills.", "Adds copper shading to profile edges."],
  ["frame-casino-rail", "Casino Rail Frame", "Rare", "CA", "A table-rail frame with market-chip lighting.", "The odds are public. The nerve is private.", "Adds casino rail lights around profiles."],
  ["frame-afterhours", "Afterhours Frame", "Common", "AH", "A dim frame for quiet sessions after the bell.", "The chart did not go home.", "Adds low afterhours glow to frame edges."],
  ["frame-dark-pool", "Dark Pool Frame", "Epic", "DF", "A deep black frame with hidden liquidity marks.", "The largest moves rarely announce themselves.", "Adds submerged marks to profile frames."],
  ["frame-ticker-crown", "Ticker Crown Frame", "Legendary", "TC", "A frame crowned by moving ticker fragments.", "The tape writes its own ceremony.", "Adds ticker crown animation to profile tops."],
  ["frame-delta-grid", "Delta Grid Frame", "Rare", "DG", "A grid frame tracking pressure across price deltas.", "The spread whispers before the print shouts.", "Adds delta grid lines to profile edges."],
  ["frame-neon-whale", "Neon Whale Frame", "Epic", "NW", "A large-order signal frame with deep neon sweep.", "First comes the shadow, then the candle.", "Adds large-order sweep light to profile edges."],
  ["frame-velvet-rope", "Velvet Rope Frame", "Legendary", "VR", "A private lounge frame with guarded black trim.", "Access is a price action of its own.", "Adds velvet-rope trim to profiles."],
  ["frame-capsule-ring", "Capsule Ring Frame", "Common", "CF", "A capsule-machine frame with circular status marks.", "Every click leaves a ring.", "Adds capsule ring marks around profiles."],
  ["frame-silver-spread", "Silver Spread Frame", "Rare", "SS", "A silver frame cut by bid-ask spread lines.", "The spread is where confidence pays rent.", "Adds spread-line cuts to profile frames."],
  ["frame-oracle-quote", "Oracle Quote Frame", "Mythic", "OQ", "A mythic frame that pulses with impossible quote marks.", "It does not predict the market. It remembers it early.", "Adds oracle quote pulses to profile frames."],
  ["frame-lunar-ledger", "Lunar Ledger Frame", "Epic", "LL", "A pale lunar frame for night-ledger collectors.", "The moon keeps cleaner books than the desk.", "Adds lunar ledger ticks to profile frames."]
];

const effectItems = [
  ["effect-buy-neon", "Buy Button Neon Effect", "Common", "BN", "A short neon ring that expands from buy actions.", "Green light is very persuasive.", "Shows a neon ring on buy clicks."],
  ["effect-sell-fireworks", "Sell Success Firework", "Rare", "SF", "Small gold fireworks for successful profit exits.", "Quiet profit still deserves a loud exit.", "Shows gold particles on sell success."],
  ["effect-loss-glitch", "Loss Warning Glitch", "Rare", "LG", "A brief glitch shake when loss zones trigger.", "Numbers crack even when eyes close.", "Adds glitch shake to loss warnings."],
  ["effect-mythic-cutscene", "Mythic Reveal Cutscene", "Mythic", "MC", "A full-screen reveal for mythic collection pulls.", "At the end of the rate table, a door opens.", "Triggers a full-screen Mythic reveal."],
  ["effect-profit-pulse", "Profit Pulse Effect", "Common", "PP", "A green pulse that expands when profit updates.", "A small plus can still raise the pulse.", "Shows pulse light on profit updates."],
  ["effect-stoploss-shard", "Stoploss Shard Effect", "Epic", "SH", "A shard-like light scatter for confirmed exits.", "The position broke. The account learned.", "Shows shard particles on stoploss events."],
  ["effect-whale-shadow", "Whale Shadow Effect", "Legendary", "WS", "A large-order shadow sweeps across the screen.", "The water moves before the quote does.", "Shows a large-order shadow sweep."],
  ["effect-dismantle-spark", "Dismantle Spark Effect", "Common", "DS", "Small Dust sparks when duplicate collections are dismantled.", "Duplicates are not waste. They are fuel.", "Shows Dust sparks on dismantle actions."],
  ["effect-bid-siren", "Bid Siren Effect", "Epic", "BS", "Red siren lines for violent bidbook changes.", "No sound. Everyone heard it.", "Adds siren lines to bidbook alerts."],
  ["effect-blackout-open", "Blackout Open Effect", "Legendary", "BO", "A blackout and relight sequence for market open.", "When the market turns on, excuses turn off.", "Adds blackout transition to open events."],
  ["effect-zero-latency", "Zero Latency Effect", "Mythic", "ZL", "A mythic fill alert that seems to arrive before time.", "Waiting was deleted. Only the print remains.", "Adds time-warp motion to fill alerts."],
  ["effect-casino-jackpot", "Casino Jackpot Flash", "Legendary", "CJ", "A slot-floor flash for unusually strong pulls.", "The machine knows when the room is watching.", "Adds jackpot flash to rare pull moments."],
  ["effect-vip-door-sweep", "VIP Door Sweep", "Rare", "VD", "A black gold sweep for premium panel openings.", "The door opens only wide enough for the quote.", "Adds VIP sweep light to panel opens."],
  ["effect-capsule-overdrive", "Capsule Overdrive", "Epic", "CO", "A stronger capsule shake before multi-pulls.", "The machine is not nervous. It is charging.", "Adds overdrive shake to capsule pulls."],
  ["effect-legendary-flash", "Legendary Flash", "Legendary", "LF", "A gold flash for Legendary collection reveals.", "Gold is not subtle, and neither is this pull.", "Adds gold flash to Legendary results."],
  ["effect-market-bell", "Market Bell Pulse", "Common", "MB", "A compact pulse wave for session changes.", "The bell is a waveform with manners.", "Adds pulse wave to session changes."],
  ["effect-neon-receipt", "Neon Receipt Trail", "Rare", "NR", "A receipt-like neon trail after confirmed actions.", "Every click leaves paperwork in light.", "Adds neon receipt trail to confirmations."],
  ["effect-orderbook-rain", "Orderbook Rain", "Epic", "OR", "Quote fragments fall through the orderbook surface.", "Liquidity falls upward when fear is involved.", "Adds falling quote fragments to orderbook views."],
  ["effect-circuit-static", "Circuit Breaker Static", "Rare", "CB", "Static noise for high-risk halted moments.", "Stillness can be loud.", "Adds static to circuit-breaker warnings."],
  ["effect-profit-confetti", "Profit Confetti", "Common", "PC", "A restrained burst of market-colored confetti.", "Celebrate fast. Re-enter slower.", "Adds confetti to profit confirmations."],
  ["effect-mythic-aura", "Mythic Aura Burst", "Mythic", "AB", "A full-screen aura burst for impossible pulls.", "The capsule did not open. The room did.", "Adds full-screen aura to Mythic results."],
  ["effect-dust-grinder", "Dust Grinder Spark", "Epic", "DG", "A bright grinder spark for bulk dismantle moments.", "The archive makes its own currency.", "Adds grinder sparks to bulk dismantle actions."]
];

const themeItems = [
  ["theme-midnight-exchange", "Midnight Exchange", "Common", "ME", "A low-light exchange theme for late trading.", "At 2 AM, numbers still work overtime.", "Applies midnight exchange colors."],
  ["theme-neon-wallstreet", "Neon Wallstreet", "Rare", "NW", "A city-market theme full of signs and ticker light.", "There are more numbers than footsteps.", "Applies neon street lighting to dashboards."],
  ["theme-underground-ops", "Underground Ops Room", "Epic", "UR", "A closed-room theme with private boards and terminals.", "The door is locked. The chart is open.", "Applies underground operations textures."],
  ["theme-blackmarket-exchange", "Black Market Exchange", "Legendary", "BX", "A secretive exchange theme with black panels and sharp light.", "Unlisted desire still finds a price.", "Applies black market exchange styling."],
  ["theme-green-room", "Green Room Ledger", "Common", "GR", "A light green ledger theme for clean transaction logs.", "Hope arrives in green first.", "Applies green ledger lighting to logs."],
  ["theme-red-circuit", "Red Circuit Room", "Rare", "RC", "A red pressure theme for circuit-breaker tension.", "Someone moves before everyone stops.", "Applies red circuit colors to risk UI."],
  ["theme-glass-vault", "Glass Vault", "Epic", "GV", "A transparent vault theme with cold metal light.", "Visible money can still feel far away.", "Applies vault glass textures to panels."],
  ["theme-aurora-market", "Aurora Market", "Legendary", "AM", "A flowing market theme with aurora quote ribbons.", "The market moves like weather with intent.", "Adds aurora light to status bars."],
  ["theme-eclipse-terminal", "Eclipse Terminal", "Mythic", "ET", "A mythic terminal theme where only prices survive the dark.", "When the light hides, PnL does not.", "Applies eclipse terminal transitions."],
  ["theme-casino-floor", "Casino Exchange Floor", "Rare", "CE", "A casino-floor theme for capsule and trade energy.", "The odds are printed. The pulse is not.", "Applies casino floor lighting."],
  ["theme-vip-lounge", "VIP Lounge Exchange", "Legendary", "VL", "A private lounge theme with black gold quiet.", "The best noise is behind the wall.", "Applies VIP lounge colors to the app."],
  ["theme-dark-pool-harbor", "Dark Pool Harbor", "Epic", "DH", "A submerged liquidity theme with deep blue panels.", "Depth looks calm until it fills.", "Applies dark pool harbor textures."],
  ["theme-capsule-arcade", "Neon Capsule Arcade", "Common", "NA", "A capsule-machine arcade theme with bright rails.", "One more pull is a design language.", "Applies capsule arcade lighting."],
  ["theme-closing-bell", "Closing Bell Theatre", "Rare", "CB", "A theatre-like close session with gold side light.", "The final print wants applause.", "Applies closing bell stage lighting."],
  ["theme-lunar-bidroom", "Lunar Bid Room", "Epic", "LB", "A pale lunar room theme for quiet bid sessions.", "The moon sees the spread clearly.", "Applies lunar bidroom lighting."],
  ["theme-chrome-futures", "Chrome Futures Desk", "Rare", "CF", "A reflective futures desk theme with chrome rails.", "Tomorrow is priced in polished metal.", "Applies chrome futures desk styling."],
  ["theme-black-ledger-alley", "Black Ledger Alley", "Common", "BA", "A narrow black ledger theme with soft green type.", "Even alleys keep clean books.", "Applies black ledger surfaces."],
  ["theme-synthetic-index", "Synthetic Index Lab", "Epic", "SI", "A lab-like theme for synthetic index energy.", "The formula has a heartbeat now.", "Applies synthetic lab panels."],
  ["theme-margin-nightclub", "Margin Nightclub", "Legendary", "MN", "A high-risk night theme with magenta leverage lights.", "The bass is just volatility in disguise.", "Applies margin nightclub lighting."],
  ["theme-plasma-auction", "Plasma Auction Hall", "Legendary", "PA", "A glowing auction theme with plasma bid rails.", "Every bid leaves heat in the hall.", "Applies plasma auction rails."],
  ["theme-golden-volatility", "Golden Volatility Pit", "Common", "GP", "A gold-trim pit theme for volatile sessions.", "Noise becomes a room when enough candles join.", "Applies gold volatility pit colors."],
  ["theme-singularity-exchange", "Singularity Exchange", "Mythic", "SE", "A mythic exchange theme centered on a collapsing quote core.", "All markets eventually ask the same question.", "Applies singularity exchange ambience."]
];

export const collections = [
  ...makeItems("Skin", skinItems),
  ...makeItems("Frame", frameItems),
  ...makeItems("Effect", effectItems),
  ...makeItems("Theme", themeItems)
];

function makeItems(type, rows) {
  return rows.map(([id, name, grade, icon, description, flavorText, effectText]) => ({
    id,
    name,
    grade,
    type,
    description,
    flavorText,
    effectText,
    icon
  }));
}
