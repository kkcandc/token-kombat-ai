export type Hair = 'short' | 'bob' | 'curly' | 'wavy' | 'silver' | 'buzz' | 'side'
export type Outfit =
  | 'zip'
  | 'suit'
  | 'leather'
  | 'coat'
  | 'sweater'
  | 'blazer'
  | 'turtleneck'
  | 'tee'
  | 'pullover'
  | 'jacket'
export type Prop =
  | 'halo'
  | 'rocket'
  | 'chip'
  | 'stone'
  | 'shield'
  | 'prism'
  | 'spark'
  | 'llama'
  | 'drone'
  | 'crystal'
  | 'cake'
  | 'code'

export interface FighterDef {
  id: string
  name: string
  last: string
  special: string
  cost: number
  blurb: string
  catchphrase: string
  color: string
  accent: string
  skin: string
  hair: Hair
  hairColor: string
  outfit: Outfit
  prop: Prop
  scale: number
  glasses?: boolean
}

export const ROSTER: FighterDef[] = [
  {
    id: 'altman',
    name: 'Sam Altman',
    last: 'ALTMAN',
    special: 'Softmax Storm',
    cost: 50,
    blurb: 'A closed loop of confidence. Orbs fan out, a shield snaps shut, and a full meter jumps the ceiling.',
    catchphrase: 'The loop is closed.',
    color: '#d9d4cc',
    accent: '#7ee0ff',
    skin: '#f0c7a4',
    hair: 'short',
    hairColor: '#5a3826',
    outfit: 'zip',
    prop: 'halo',
    scale: 1,
  },
  {
    id: 'elon',
    name: 'Elon Musk',
    last: 'MUSK',
    special: 'Meme Rocket',
    cost: 55,
    blurb: 'An orbital meme rocket dives in, then a roast bubble stuns the timeline.',
    catchphrase: 'Stage separation complete.',
    color: '#1c1c1f',
    accent: '#ff8a3d',
    skin: '#e7b894',
    hair: 'short',
    hairColor: '#2a211c',
    outfit: 'suit',
    prop: 'rocket',
    scale: 1.07,
  },
  {
    id: 'jensen',
    name: 'Jensen Huang',
    last: 'HUANG',
    special: 'CUDA Beam',
    cost: 65,
    blurb: 'Leather-jacket tensor light. A chest-high beam that crouch and a good jump can answer.',
    catchphrase: 'The cores signed off.',
    color: '#141414',
    accent: '#7dff6a',
    skin: '#c48a62',
    hair: 'silver',
    hairColor: '#e6e8ee',
    outfit: 'leather',
    prop: 'chip',
    scale: 1.02,
  },
  {
    id: 'demis',
    name: 'Demis Hassabis',
    last: 'HASSABIS',
    special: 'Alpha Rewind',
    cost: 50,
    blurb: 'Steps back into a better plan and paints a go-board that slows the round.',
    catchphrase: 'That was the better plan.',
    color: '#1d2a44',
    accent: '#f4f1ea',
    skin: '#e4b48c',
    hair: 'side',
    hairColor: '#1c1a19',
    outfit: 'coat',
    prop: 'stone',
    scale: 1,
    glasses: true,
  },
  {
    id: 'dario',
    name: 'Dario Amodei',
    last: 'AMODEI',
    special: 'Constitutional Counter',
    cost: 40,
    blurb: 'A safety clause. If they swing during the window, the hit comes back and a little health returns.',
    catchphrase: 'Inside the constitution.',
    color: '#2a2e33',
    accent: '#f0c14a',
    skin: '#f0c9a6',
    hair: 'curly',
    hairColor: '#3a2a22',
    outfit: 'sweater',
    prop: 'shield',
    scale: 1.03,
  },
  {
    id: 'mira',
    name: 'Mira Murati',
    last: 'MURATI',
    special: 'Mirage Clones',
    cost: 55,
    blurb: 'Two extra modalities step forward and throw the punch while the original slides back.',
    catchphrase: 'All modalities agree.',
    color: '#f3efe6',
    accent: '#b388ff',
    skin: '#e8b898',
    hair: 'bob',
    hairColor: '#161311',
    outfit: 'blazer',
    prop: 'prism',
    scale: 0.96,
  },
  {
    id: 'ilya',
    name: 'Ilya Sutskever',
    last: 'SUTSKEVER',
    special: 'Singularity Charge',
    cost: 40,
    blurb: 'Spends the whole meter. One scaled step, armor on, and the punch arrives early.',
    catchphrase: 'Scale showed up.',
    color: '#121212',
    accent: '#fff4d2',
    skin: '#f2d0b0',
    hair: 'curly',
    hairColor: '#1a1412',
    outfit: 'turtleneck',
    prop: 'spark',
    scale: 1.04,
  },
  {
    id: 'zuck',
    name: 'Mark Zuckerberg',
    last: 'ZUCKERBERG',
    special: 'Feed Grab',
    cost: 55,
    blurb: 'A short-form grab. A llama swarm pecks in close; whiff it and one still runs the lane.',
    catchphrase: 'The feed has spoken.',
    color: '#9aa0a6',
    accent: '#4ea1ff',
    skin: '#f0c7a4',
    hair: 'curly',
    hairColor: '#6b442c',
    outfit: 'tee',
    prop: 'llama',
    scale: 0.98,
  },
  {
    id: 'satya',
    name: 'Satya Nadella',
    last: 'NADELLA',
    special: 'Copilot Drop',
    cost: 60,
    blurb: 'Assist drones sketch the answer, then a cloud finishes the sentence.',
    catchphrase: 'Consider that shipped.',
    color: '#3a78d0',
    accent: '#d7ecff',
    skin: '#b8794a',
    hair: 'buzz',
    hairColor: '#d5d8de',
    outfit: 'pullover',
    prop: 'drone',
    scale: 1.01,
    glasses: true,
  },
  {
    id: 'feifei',
    name: 'Fei-Fei Li',
    last: 'LI',
    special: 'Crystal Snare',
    cost: 48,
    blurb: 'A vision crystal lands, labels the floor, and holds anyone who steps on the caption.',
    catchphrase: 'Labeled and settled.',
    color: '#7a2344',
    accent: '#ffd0e0',
    skin: '#e0b08a',
    hair: 'wavy',
    hairColor: '#1a1412',
    outfit: 'jacket',
    prop: 'crystal',
    scale: 0.95,
  },
  {
    id: 'lecun',
    name: 'Yann LeCun',
    last: 'LECUN',
    special: 'Cake Slam',
    cost: 50,
    blurb: 'Layers of convnet crumb. The cake shows up, splatters, and the floor gets slippery.',
    catchphrase: 'The cake made contact.',
    color: '#243044',
    accent: '#ffb7d5',
    skin: '#f3d2b4',
    hair: 'wavy',
    hairColor: '#d9dde4',
    outfit: 'jacket',
    prop: 'cake',
    scale: 1.03,
  },
  {
    id: 'karpathy',
    name: 'Andrej Karpathy',
    last: 'KARPATHY',
    special: 'Backprop Spiral',
    cost: 50,
    blurb: 'Glyphs orbit, then a helix of homework tracks across the coliseum.',
    catchphrase: 'Backprop sends its regards.',
    color: '#161616',
    accent: '#b6ff4a',
    skin: '#e8c09a',
    hair: 'side',
    hairColor: '#4a3428',
    outfit: 'tee',
    prop: 'code',
    scale: 1,
    glasses: true,
  },
]

export function getFighter(id: string): FighterDef {
  const found = ROSTER.find((f) => f.id === id)
  if (!found) throw new Error(`Unknown fighter: ${id}`)
  return found
}
