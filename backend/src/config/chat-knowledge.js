/**
 * Fixed knowledge for the website chat assistant.
 * Everything here is taken from the website pages (contactus.htm, service pages).
 * Prices, packages, FAQs, phone, WhatsApp and email are NOT here: they are read live from the
 * database so the admin panel stays the single place to change them.
 */

// Clinic addresses and hours exactly as listed on contactus.htm
const CLINICS = [
  { key: 'mumbai', city: 'Mumbai', name: 'Flagship Clinic, Mulund', address: '228-A Shanti Ind Estate, S N Road, Mulund West, Mumbai - 400080', hours: 'Mon–Sat 9:00 AM – 8:00 PM, Sunday by prior appointment', words: ['mumbai', 'mulund', 'thane', 'bombay'] },
  { key: 'pune', city: 'Pune', name: 'SPOUZY Wellness Lounge', address: 'Koregaon Park North Main Rd, Pune - 411001', hours: 'Mon–Fri 10:00 AM – 7:00 PM, Saturday 10:00 AM – 4:00 PM', words: ['pune', 'koregaon'] },
  { key: 'delhi', city: 'New Delhi', name: 'SPOUZY Medical & Mediation Wing', address: 'South Extension II, New Delhi - 110049', hours: 'Mon–Sat 10:00 AM – 6:00 PM, Sunday closed', words: ['delhi', 'new delhi', 'south extension', 'ncr', 'noida', 'gurgaon', 'gurugram'] },
  { key: 'bengaluru', city: 'Bengaluru', name: 'SPOUZY Clinic & PSG Counsel', address: '100 Feet Rd, Indiranagar, Bengaluru - 560038', hours: 'Mon–Sat 9:30 AM – 6:30 PM, Sunday by appointment', words: ['bengaluru', 'bangalore', 'indiranagar', 'blr'] }
];

// Service slug → words people use for it (English + common Hinglish) and its website page
const SERVICE_TOPICS = {
  'premarital': {
    words: ['pre marriage', 'premarriage', 'pre marital', 'premarital', 'before marriage', 'before wedding', 'shaadi se pehle', 'shadi se pehle', 'engaged', 'engagement', 'fiance', 'fiancee', 'would be', 'getting married', 'pre wedding'],
    page: 'pre-marriage.htm', pageLabel: 'Pre-Marriage guidance'
  },
  'couples-therapy': {
    words: ['post marriage', 'postmarriage', 'post marital', 'after marriage', 'shaadi ke baad', 'shadi ke baad', 'marriage counselling', 'marriage counseling', 'couple', 'couples', 'marital', 'husband', 'wife', 'spouse', 'married', 'marriage problem', 'relationship problem', 'fights', 'fighting', 'trust issue', 'affair', 'cheating', 'communication'],
    page: 'post-marriage.htm', pageLabel: 'Post-Marriage counselling'
  },
  'intimacy-clinic': {
    words: ['intimacy', 'intimate', 'sexual', 'sex', 'erectile', 'premature', 'libido', 'performance', 'doctor consultation', 'breast', 'genital', 'aesthetic', 'aesthetics', 'physical intimacy', 'sexologist'],
    page: 'intimate-health.htm', pageLabel: 'Intimate health care'
  },
  'mediation': {
    words: ['divorce', 'mediation', 'mediator', 'separation', 'separate', 'custody', 'alimony', 'settlement', 'talaq', 'dispute'],
    page: 'divorce-mediation.htm', pageLabel: 'Divorce mediation'
  },
  'general': {
    words: ['general guidance', 'individual session', 'alone', 'personal guidance', 'stress', 'guidance'],
    page: 'relationships.htm', pageLabel: 'Relationship guidance'
  }
};

// Key pages the assistant can link to
const PAGES = {
  booking: { url: 'book-appoinment.htm', label: 'Book an appointment' },
  freeBooking: { url: 'book-appoinment.htm?type=free', label: 'Book a free consultation' },
  packages: { url: 'packages.htm', label: 'See all packages' },
  cart: { url: 'cart.htm', label: 'Open your cart' },
  account: { url: 'account.htm', label: 'My Account' },
  appointments: { url: 'account.htm#appointments', label: 'My appointments' },
  orders: { url: 'account.htm#orders', label: 'My orders' },
  contact: { url: 'contactus.htm', label: 'Contact & clinics' },
  faq: { url: 'faq.htm', label: 'FAQs' },
  team: { url: 'team.htm', label: 'Meet the team' },
  about: { url: 'about-us.htm', label: 'About SPOUZY' },
  careers: { url: 'careers.htm', label: 'Careers' },
  joinDoctor: { url: 'join-doctor.htm', label: 'Join as a doctor' },
  joinCounsellor: { url: 'join-counsellor.htm', label: 'Join as a counsellor' },
  refund: { url: 'refund-policy.htm', label: 'Refund & cancellation policy' },
  payment: { url: 'payment-policy.htm', label: 'Payment & billing policy' },
  privacy: { url: 'privacy-policy.htm', label: 'Privacy policy' },
  confidentiality: { url: 'confidentiality.htm', label: 'Confidentiality pledge' },
  tele: { url: 'teleconsultation-policy.htm', label: 'Online sessions policy' },
  terms: { url: 'terms.htm', label: 'Terms of use' },
  blog: { url: 'blog.htm', label: 'Blog' }
};

// Spelling mistakes people often make → the word we understand
const TYPOS = {
  marrage: 'marriage', marraige: 'marriage', mariage: 'marriage', marrige: 'marriage', marriege: 'marriage', mrriage: 'marriage',
  shadi: 'shaadi', shaadi: 'shaadi',
  councelling: 'counselling', counciling: 'counselling', counceling: 'counselling', counseling: 'counselling', cousnelling: 'counselling',
  councellor: 'counsellor', counselor: 'counsellor', councelor: 'counsellor',
  consultaion: 'consultation', consulation: 'consultation', consultion: 'consultation', consultaton: 'consultation',
  appoinment: 'appointment', appointmnet: 'appointment', apointment: 'appointment', appointmet: 'appointment', appoitment: 'appointment',
  pakage: 'package', packege: 'package', pacakge: 'package', packge: 'package', pakages: 'packages', packeges: 'packages',
  prise: 'price', pirce: 'price', pric: 'price', prize: 'price', cost: 'cost',
  adress: 'address', addres: 'address', loaction: 'location', locaton: 'location',
  numbr: 'number', nmber: 'number', mobil: 'mobile',
  emial: 'email', mail: 'mail', gmail: 'email',
  timimg: 'timing', timeing: 'timing', timmings: 'timings',
  refnd: 'refund', cancle: 'cancel', cancell: 'cancel',
  docter: 'doctor', doctr: 'doctor', dr: 'doctor',
  divorse: 'divorce', devorce: 'divorce', divorce: 'divorce'
};

// Crisis words → safety message (always answered first)
const CRISIS_WORDS = ['suicide', 'kill myself', 'end my life', 'want to die', 'self harm', 'hurt myself', 'cutting myself', 'marna chahta', 'marna chahti', 'jeena nahi', 'abuse', 'beating me', 'hits me', 'domestic violence', 'violence at home', 'rape', 'assault', 'emergency'];

module.exports = { CLINICS, SERVICE_TOPICS, PAGES, TYPOS, CRISIS_WORDS };
