/**
 * Anonymitetsgräns: så många studenter som måste ha skattat ett kort eller en kategori innan
 * den rangordnas eller visas, så att ingen enskild students svar kan läsas ut. Delas av
 * kursöversikten och veckobrevet. Ligger i egen fil utan "use client"/"use server" så att
 * både klient- och serverkod kan importera den.
 */
export const MIN_STUDENTS = 5;
