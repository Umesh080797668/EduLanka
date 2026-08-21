import fs from 'node:fs';

const additions = {
  en: { Sidebar: {
    sectionOverview: 'Overview', sectionPeople: 'People', sectionAcademics: 'Academics',
    sectionCommunication: 'Communication', sectionSettings: 'Settings',
    sectionPlatform: 'Platform', sectionSecurity: 'Security & Audit',
    collapse: 'Collapse sidebar', expand: 'Expand sidebar', signedInAs: 'Signed in as',
  }},
  si: { Sidebar: {
    sectionOverview: 'දළ විශ්ලේෂණය', sectionPeople: 'පුද්ගලයින්', sectionAcademics: 'අධ්‍යයන',
    sectionCommunication: 'සන්නිවේදනය', sectionSettings: 'සැකසුම්',
    sectionPlatform: 'වේදිකාව', sectionSecurity: 'ආරක්ෂාව සහ විගණනය',
    collapse: 'පැති තීරුව හකුළන්න', expand: 'පැති තීරුව දිගු කරන්න', signedInAs: 'පිවිසී ඇත්තේ',
  }},
  ta: { Sidebar: {
    sectionOverview: 'மேலோட்டம்', sectionPeople: 'நபர்கள்', sectionAcademics: 'கல்வி',
    sectionCommunication: 'தொடர்பு', sectionSettings: 'அமைப்புகள்',
    sectionPlatform: 'தளம்', sectionSecurity: 'பாதுகாப்பு & தணிக்கை',
    collapse: 'பக்கப்பட்டியை மறை', expand: 'பக்கப்பட்டியை விரி', signedInAs: 'உள்நுழைந்தவர்',
  }},
};

for (const [locale, ns] of Object.entries(additions)) {
  const file = `messages/${locale}.json`;
  const json = JSON.parse(fs.readFileSync(file, 'utf8'));
  for (const [name, entries] of Object.entries(ns)) json[name] = { ...(json[name] ?? {}), ...entries };
  fs.writeFileSync(file, JSON.stringify(json, null, 4) + '\n');
  console.log(locale, 'ok');
}
