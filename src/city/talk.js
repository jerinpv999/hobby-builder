/* Conversations with townspeople. Replies are written here and filled in with what is really in the city:
   the time, the season, what is nearby and which way things are. No outside service is used. */

const WOMEN = ["Asha", "Meera", "Anjali", "Priya", "Lakshmi", "Sofia", "Maria", "Elena", "Amara", "Yuki", "Fatima", "Grace", "Nina", "Divya"];
const MEN = ["Arjun", "Ravi", "Joseph", "Vishnu", "Anil", "Daniel", "Mateo", "Kofi", "Hiro", "Omar", "Thomas", "Rahul", "Leo", "Suresh"];
const JOBS = [
  ["teacher", "school", "I teach at the school. The children keep me busy!"],
  ["nurse", "hospital", "I'm a nurse at the hospital. Long shifts, but I love it."],
  ["shopkeeper", "shop", "I run a little shop. Come by some time."],
  ["farmer", "field", "I farm the land out by the fields."],
  ["pilot", "terminal", "I'm a pilot. I flew in this morning, the view of the city was lovely."],
  ["engineer", "office", "I'm an engineer. I work in one of the offices."],
  ["train driver", "railstation", "I drive the trains. Right on time, mostly."],
  ["firefighter", "firestation", "I'm with the fire service."],
  ["chef", "hotel", "I cook at the hotel. Try the fish curry."],
  ["factory worker", "factory", "I work at the factory."],
  ["gardener", "park", "I look after the parks."],
];
const KIDS = [["student", "school", "I go to the school here. Maths is my favourite... after lunch."]];
const SKIN = ["#f1c9a5", "#d9a374", "#b97f52", "#8d5b3a", "#e8b48c"];
const HAIR = ["#1c1411", "#3a2416", "#6b4423", "#b8864a", "#8c8c8c"];
const SHIRTS = ["#d94f45", "#2f6fc4", "#2a9d8f", "#f2a03d", "#7a54a8", "#e8e8e8", "#3f8f4f", "#e46f9c", "#f4d35e"];
const PANTS = ["#2f3b52", "#4a4a4a", "#6b5844", "#1f2a44", "#7d8794"];

export function makeProfile(rnd = Math.random) {
  const pick = (a) => a[Math.floor(rnd() * a.length)];
  const child = rnd() < 0.15;
  const woman = rnd() < 0.5;
  const [job, place, line] = pick(child ? KIDS : JOBS);
  return {
    name: pick(woman ? WOMEN : MEN), woman, child, job, place, jobLine: line,
    mood: pick(["cheerful", "calm", "busy", "curious"]),
    colors: { p_skin: pick(SKIN), p_hair: pick(HAIR), p_shirt: pick(SHIRTS), p_pants: pick(PANTS) },
  };
}

/* things people can be asked the way to: words to listen for, and the tiles that count */
export const PLACES = [
  ["airport", /airport|plane|flight|terminal|runway/, ["terminal", "runway"]],
  ["hospital", /hospital|doctor|clinic/, ["hospital"]],
  ["school", /school/, ["school"]],
  ["park", /park|garden/, ["park"]],
  ["railway station", /rail|train/, ["railstation"]],
  ["metro station", /metro/, ["metrostation"]],
  ["shop", /shop|store|buy/, ["shop", "mall"]],
  ["mall", /mall/, ["mall"]],
  ["hotel", /hotel|stay|sleep|room/, ["hotel"]],
  ["gas station", /gas|petrol|fuel/, ["gasstation"]],
  ["fire station", /fire/, ["firestation"]],
  ["church", /church|pray/, ["church"]],
  ["stadium", /stadium|match|game|sport/, ["stadium"]],
  ["farm", /farm|field|cow|rice|wheat/, ["field", "paddy", "vegfarm", "orchard", "pasture", "barn"]],
  ["lake", /lake|water|pond|swim/, ["water"]],
  ["office", /office|work/, ["office", "tower"]],
  ["factory", /factory/, ["factory"]],
];

export const QUESTIONS = [
  ["name", "What's your name?"],
  ["job", "What do you do?"],
  ["city", "How do you like the city?"],
  ["nearby", "What's around here?"],
  ["weather", "How's the weather?"],
  ["time", "What time is it?"],
  ["joke", "Tell me a joke"],
];

export function findPlace(grid, from, types) {
  let best = null;
  grid.forEach((row, z) => row.forEach((c, x) => {
    if (!c || !types.includes(c.t)) return;
    const d = Math.hypot(x - from.x, z - from.z);
    if (!best || d < best.d) best = { x, z, d };
  }));
  return best;
}

export function directions(from, to) {
  const dx = to.x - from.x, dz = to.z - from.z;
  if (Math.hypot(dx, dz) < 1.6) return "it's right here, just next to us";
  const ns = dz < 0 ? "north" : "south", ew = dx > 0 ? "east" : "west";
  const way = Math.abs(dx) > 2 * Math.abs(dz) ? ew : Math.abs(dz) > 2 * Math.abs(dx) ? ns : `${ns}-${ew}`;
  const blocks = Math.round(Math.abs(dx) + Math.abs(dz));
  return `head ${way}, about ${blocks} blocks`;
}

export function greeting(p, world) {
  const part = world.hour < 5 || world.hour >= 21 ? "You're out late!" : world.hour < 12 ? "Good morning!" : world.hour < 17 ? "Good afternoon!" : "Good evening!";
  const extra = { cheerful: "Lovely to see a new face.", calm: "How can I help?", busy: "I've only got a minute.", curious: "Are you new around here?" }[p.mood];
  return `${part} ${extra}`;
}

const JOKES = [
  "Why did the traffic light turn red? You would too if you had to change in the middle of the street.",
  "What runs around a field but never moves? A fence.",
  "Why don't skyscrapers play cards? Too many stories.",
  "I asked the train driver how he got the job. He said he just got on track.",
];

/* world: { grid, hour, season, stats, cityName, traffic }; at: the tile the person is standing on.
   Returns { text, target?, bye? } */
export function reply(p, input, world, at, rnd = Math.random) {
  const q = String(input || "").toLowerCase().trim();
  const is = (id, words) => q === id || words.test(q);

  const place = PLACES.find(([, words]) => words.test(q));
  if (place && /where|way|find|get to|go to|nearest|direction|how do i/.test(q)) {
    const [label, , types] = place;
    const found = findPlace(world.grid, at, types);
    if (!found) return { text: `There's no ${label} in ${world.cityName} yet. You could build one!` };
    return { text: `The nearest ${label}? ${directions(at, found).replace(/^./, (c) => c.toUpperCase())}. Look for the beacon.`, target: found };
  }
  if (is("bye", /\b(bye|goodbye|see you|later)\b/)) return { text: "Bye! Enjoy your walk.", bye: true };
  if (is("name", /your name|who are you|\bname\b/)) return { text: `I'm ${p.name}.${p.child ? " I'm nearly ten!" : " Nice to meet you."}` };
  if (is("job", /what do you do|your job|work as|occupation|\bjob\b/)) return { text: p.jobLine };
  if (is("weather", /weather|season|cold|hot|snow|rain|sunny/)) {
    return { text: { spring: "Spring is here. The blossom is out and the air smells fresh.", summer: "It's a warm summer day. Stay in the shade if you can.", autumn: "Autumn. Look at the colours on those trees!", winter: "Brr! Snow everywhere. Mind your step, the water's frozen." }[world.season] };
  }
  if (is("time", /what time|the time|o'clock|how late/)) {
    const h = Math.floor(world.hour), m = Math.round((world.hour % 1) * 60);
    return { text: `It's about ${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}.${h >= 19 || h < 6 ? " The windows are all lit up." : ""}` };
  }
  if (is("nearby", /around here|nearby|near here|close by/)) {
    const seen = PLACES.map(([label, , types]) => ({ label, f: findPlace(world.grid, at, types) })).filter((s) => s.f && s.f.d < 6).sort((a, b) => a.f.d - b.f.d).slice(0, 3);
    return seen.length ? { text: `Close by there's ${seen.map((s) => `${/^[aeiou]/.test(s.label) ? "an" : "a"} ${s.label} (${directions(at, s.f)})`).join(", ")}.` } : { text: "Not much right here. It's a quiet spot." };
  }
  if (is("city", /city|town|like it|live here/)) {
    const s = world.stats;
    const size = s.residents > 2000 ? "It's a busy place" : s.residents > 300 ? "It's a friendly town" : "It's a small place so far";
    const wish = s.green < 20 ? " I wish we had more trees." : s.farms > 20 ? " I like having the farms close by." : " The parks are my favourite part.";
    return { text: `${size}: ${s.residents.toLocaleString()} of us live in ${world.cityName}.${wish}${world.traffic ? "" : " It's very quiet with no traffic today."}` };
  }
  if (is("joke", /joke|funny|laugh/)) return { text: JOKES[Math.floor(rnd() * JOKES.length)] };
  if (/\b(hi|hello|hey|namaste|good (morning|afternoon|evening))\b/.test(q)) return { text: greeting(p, world) };
  if (/thank/.test(q)) return { text: "You're welcome!" };
  if (/how are you/.test(q)) return { text: { cheerful: "Wonderful, thanks for asking!", calm: "Very well, thank you.", busy: "A bit rushed, but fine.", curious: "Good! And who might you be?" }[p.mood] };
  if (place) return { text: `Ah, the ${place[0]}. Ask me where it is and I'll point the way.` };
  return { text: "Hmm, I'm not sure about that. Ask me about the city, the weather, or the way to somewhere, like \"Where is the park?\"" };
}
