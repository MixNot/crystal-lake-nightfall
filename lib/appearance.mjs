export const JASON_SKINS=[
 {id:'classic',name:'Классический',tag:'ХОККЕЙНАЯ МАСКА',description:'Потёртая маска, тяжёлая куртка и мачете.',coat:'#425344',trim:'#7d8b68',pants:'#292d2b',mask:'#ded9be',face:'hockey',scale:1.12},
 {id:'sack',name:'Джейсон в мешке',tag:'ЧАСТЬ II',description:'Мешок с одним отверстием для глаза, верёвка и рабочий комбинезон.',coat:'#435a6b',trim:'#84949b',pants:'#344855',mask:'#c5af83',face:'sack',scale:1.1},
 {id:'x',name:'Джейсон X',tag:'UBER JASON',description:'Металлическая маска, красные линзы и сегментированная броня.',coat:'#89999f',trim:'#d3e1df',pants:'#374950',mask:'#bdcfce',face:'metal',scale:1.16},
 {id:'young',name:'Маленький Джейсон',tag:'ТЕНЬ ЛАГЕРЯ',description:'Невысокая фигура, неровные пряди волос и изношенная лагерная рубашка.',coat:'#9e8d69',trim:'#d0bd91',pants:'#485a65',mask:'#bfa17d',face:'young',scale:.8},
 {id:'undead',name:'Со дна озера',tag:'ВОЗВРАЩЕНИЕ',description:'Тёмная мокрая одежда, цепь и расколотая маска.',coat:'#343f3c',trim:'#62765e',pants:'#222e2c',mask:'#a7ad92',face:'undead',scale:1.13}
];
export const SURVIVOR_SKINS=[
 {id:'camp',name:'Лагерь 1984',tag:'ЛАГЕРНАЯ КЛАССИКА',description:'Синяя куртка, светлая футболка и походный рюкзак.',coat:'#527990',trim:'#b9d4d8',pants:'#35424a',skin:'#d3ab85',hair:'#302d29',style:'jacket'},
 {id:'denim',name:'Ночная смена',tag:'ДЖИНСОВАЯ КУРТКА',description:'Джинсовая куртка, длинные волосы и бордовый шарф.',coat:'#708dad',trim:'#d5c09d',pants:'#453f50',skin:'#c58b68',hair:'#50342c',style:'longhair'},
 {id:'rain',name:'Под дождём',tag:'ЖЁЛТЫЙ ДОЖДЕВИК',description:'Яркий дождевик с капюшоном и резиновые сапоги.',coat:'#c7a647',trim:'#f1d984',pants:'#364c43',skin:'#9c6b50',hair:'#25272a',style:'hood'},
 {id:'varsity',name:'Капитан команды',tag:'УНИВЕРСИТЕТСКАЯ КУРТКА',description:'Бордовая куртка со светлыми рукавами и бейсболка.',coat:'#934b4e',trim:'#e1d2b6',pants:'#314559',skin:'#e0b897',hair:'#47352b',style:'varsity'},
 {id:'ranger',name:'Лесной дозор',tag:'ПОХОДНАЯ ФОРМА',description:'Зелёная форма, карманы и широкополая шляпа.',coat:'#6d8062',trim:'#b7c89b',pants:'#444d3d',skin:'#885f49',hair:'#242a26',style:'ranger'},
 {id:'field',name:'Полевой медик',tag:'СПАСАТЕЛЬНАЯ ГРУППА',description:'Светлая куртка с красным крестом и сумка первой помощи.',coat:'#d3d5c8',trim:'#a95b53',pants:'#526261',skin:'#d4b698',hair:'#a98258',style:'medic'}
];
export const skinOptions=role=>role==='jason'?JASON_SKINS:SURVIVOR_SKINS;
export const defaultSkin=role=>({jason:'classic',mechanic:'camp',scout:'denim',guard:'ranger',medic:'field'})[role]||'camp';
export function skinFor(role,id){return skinOptions(role).find(s=>s.id===id)||skinOptions(role).find(s=>s.id===defaultSkin(role));}
export const validSkin=(role,id)=>skinOptions(role).some(s=>s.id===id);
