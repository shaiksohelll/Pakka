import indianCitiesJson from "indian-cities-json";

export const TIER1_CITIES = [
  "Mumbai",
  "Delhi",
  "Bengaluru",
  "Chennai",
  "Hyderabad",
  "Pune",
  "Kolkata",
  "Ahmedabad",
] as const;

export type Tier1City = (typeof TIER1_CITIES)[number];

export const CITY_AREAS: Record<Tier1City, string[]> = {
  Mumbai: [
    "Andheri East","Andheri West","Bandra East","Bandra West","Borivali","Chembur",
    "Colaba","Dadar","Dharavi","Fort","Ghatkopar","Goregaon","Jogeshwari",
    "Juhu","Kandivali","Khar","Kurla","Lower Parel","Malad","Matunga",
    "Mulund","Navi Mumbai","Parel","Powai","Santacruz","Sion","Thane",
    "Versova","Vikhroli","Vile Parle","Wadala","Worli","Dombivli","Kalyan",
  ],
  Delhi: [
    "Connaught Place","Defence Colony","Dwarka","Greater Kailash","Green Park",
    "Hauz Khas","Janakpuri","Karol Bagh","Lajpat Nagar","Laxmi Nagar",
    "Malviya Nagar","Mayur Vihar","Model Town","Nehru Place","Okhla",
    "Patel Nagar","Paschim Vihar","Pitampura","Preet Vihar","Rajouri Garden",
    "Rohini","Saket","Sarojini Nagar","Shahdara","South Extension",
    "Tilak Nagar","Uttam Nagar","Vasant Kunj","Vasant Vihar","Vikaspuri",
  ],
  Bengaluru: [
    "BTM Layout","Banashankari","Bannerghatta Road","Begur","Bellandur",
    "Bommanahalli","Brookefield","Carmelaram","Cox Town","Domlur",
    "Electronic City","HSR Layout","Hebbal","Indiranagar","JP Nagar",
    "Jayanagar","Koramangala","Krishnarajapuram","Madiwala","Malleswaram",
    "Marathahalli","Nagarbhavi","RT Nagar","Rajajinagar","Sarjapur Road",
    "Shivajinagar","Ulsoor","Whitefield","Yelahanka","Yeswanthpur",
  ],
  Chennai: [
    "Adambakkam","Adyar","Ambattur","Anna Nagar","Ashok Nagar",
    "Besant Nagar","Chromepet","Egmore","Guindy","Kilpauk",
    "Kodambakkam","Kolathur","Korattur","Medavakkam","Mylapore",
    "Nungambakkam","Perambur","Perungudi","Porur","RA Puram",
    "Saidapet","Sholinganallur","T Nagar","Tambaram","Thiruvanmiyur",
    "Velachery","Villivakkam","Virugambakkam","West Mambalam",
  ],
  Hyderabad: [
    "Ameerpet","Attapur","Banjara Hills","Begumpet","Chanda Nagar",
    "Dilsukhnagar","Gachibowli","HITEC City","Himayatnagar","Jubilee Hills",
    "Kondapur","Kukatpally","LB Nagar","Madhapur","Manikonda",
    "Mehdipatnam","Miyapur","Moosapet","Nagole","Nanakramguda",
    "Nizampet","Panjagutta","Patancheru","Raidurgam","SR Nagar",
    "Secunderabad","Shaikpet","Toli Chowki","Uppal","Ameerpet",
  ],
  Pune: [
    "Aundh","Baner","Camp","Chinchwad","Deccan","Hadapsar",
    "Hinjawadi","Kalyani Nagar","Karve Nagar","Katraj","Kharadi",
    "Kondhwa","Kothrud","Magarpatta","Model Colony","Mundhwa",
    "Nibm","Pashan","Pimple Saudagar","Pimpri","Ravet",
    "Salisbury Park","Shivajinagar","Sinhagad Road","Viman Nagar",
    "Vishrantwadi","Wakad","Wagholi","Warje","Yerawada",
  ],
  Kolkata: [
    "Alipore","Ballygunge","Baranagar","Behala","Belgharia",
    "Beliaghata","Bosepukur","Dum Dum","Entally","Garden Reach",
    "Gariahat","Garia","Howrah","Jadavpur","Jodhpur Park",
    "Kankurgachi","Kasba","Lake Town","Liluah","Maniktala",
    "New Town","Park Circus","Park Street","Rajarhat","Salt Lake",
    "Shyambazar","Sinthee","Sodepur","Tollygunge","Ultadanga",
  ],
  Ahmedabad: [
    "Ambawadi","Anandnagar","Bodakdev","Bopal","C G Road",
    "Chandkheda","Ellisbridge","Ghatlodiya","Gota","Isanpur",
    "Jodhpur","Maninagar","Memnagar","Naroda","Navrangpura",
    "New Ranip","Nikol","Odhav","Paldi","Prahlad Nagar",
    "Ranip","Sabarmati","Sanand","Sarkhej","Satellite",
    "Shahibaug","Thaltej","Vastral","Vastrapur","Vejalpur",
  ],
};

export function isTier1City(city: string): city is Tier1City {
  return (TIER1_CITIES as readonly string[]).includes(city);
}

const _rawCities = (
  indianCitiesJson as unknown as { cities: { name: string }[] }
).cities ?? [];

export const ALL_CITIES: string[] = Array.from(
  new Set([...TIER1_CITIES, ..._rawCities.map((c) => c.name)])
).sort();
