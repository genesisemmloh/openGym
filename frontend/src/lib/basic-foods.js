// Everyday foods with their usual values per 100 g (rounded, as eaten: cooked where it is cooked),
// so the food search finds "rice" or "apple" at once, offline, before any brand. Names in English,
// Spanish and German. A rough guide, like any food table: brands and recipes differ.
//
// [id, en, es, de, kcal per 100 g, protein g per 100 g, a usual portion in g]
const ROWS = [
  // fruit
  ['apple', 'Apple', 'Manzana', 'Apfel', 52, 0.3, 180],
  ['banana', 'Banana', 'Plátano', 'Banane', 89, 1.1, 120],
  ['orange', 'Orange', 'Naranja', 'Orange', 47, 0.9, 150],
  ['pear', 'Pear', 'Pera', 'Birne', 57, 0.4, 170],
  ['grapes', 'Grapes', 'Uvas', 'Weintrauben', 69, 0.7, 120],
  ['strawberries', 'Strawberries', 'Fresas', 'Erdbeeren', 32, 0.7, 150],
  ['blueberries', 'Blueberries', 'Arándanos', 'Heidelbeeren', 57, 0.7, 100],
  ['pineapple', 'Pineapple', 'Piña', 'Ananas', 50, 0.5, 150],
  ['mango', 'Mango', 'Mango', 'Mango', 60, 0.8, 150],
  ['watermelon', 'Watermelon', 'Sandía', 'Wassermelone', 30, 0.6, 250],
  ['kiwi', 'Kiwi', 'Kiwi', 'Kiwi', 61, 1.1, 75],
  ['peach', 'Peach', 'Durazno', 'Pfirsich', 39, 0.9, 150],
  ['avocado', 'Avocado', 'Aguacate', 'Avocado', 160, 2, 100],
  ['dates', 'Dates', 'Dátiles', 'Datteln', 282, 2.5, 30],
  ['raisins', 'Raisins', 'Pasas', 'Rosinen', 299, 3.1, 30],
  // vegetables
  ['tomato', 'Tomato', 'Tomate', 'Tomate', 18, 0.9, 120],
  ['cucumber', 'Cucumber', 'Pepino', 'Gurke', 15, 0.7, 100],
  ['lettuce', 'Lettuce', 'Lechuga', 'Salat', 15, 1.4, 80],
  ['carrot', 'Carrot', 'Zanahoria', 'Karotte', 41, 0.9, 80],
  ['broccoli', 'Broccoli', 'Brócoli', 'Brokkoli', 35, 2.4, 150],
  ['spinach', 'Spinach', 'Espinaca', 'Spinat', 23, 2.9, 100],
  ['bell pepper', 'Bell pepper', 'Pimiento', 'Paprika', 31, 1, 120],
  ['onion', 'Onion', 'Cebolla', 'Zwiebel', 40, 1.1, 80],
  ['zucchini', 'Zucchini', 'Calabacín', 'Zucchini', 17, 1.2, 150],
  ['mushrooms', 'Mushrooms', 'Champiñones', 'Champignons', 22, 3.1, 100],
  ['corn', 'Sweet corn', 'Elote / maíz', 'Mais', 96, 3.4, 100],
  ['peas', 'Peas', 'Guisantes / chícharos', 'Erbsen', 81, 5.4, 100],
  ['green beans', 'Green beans', 'Ejotes / judías verdes', 'Grüne Bohnen', 35, 1.9, 120],
  ['salad mixed', 'Mixed salad', 'Ensalada mixta', 'Gemischter Salat', 20, 1.3, 150],
  // potatoes, grains, bread
  ['potato boiled', 'Potato, boiled', 'Papa cocida', 'Kartoffel, gekocht', 87, 1.9, 200],
  ['fries', 'French fries', 'Papas fritas', 'Pommes frites', 312, 3.4, 150],
  ['sweet potato', 'Sweet potato, baked', 'Camote / batata', 'Süßkartoffel', 90, 2, 200],
  ['rice white', 'White rice, cooked', 'Arroz blanco cocido', 'Reis, gekocht', 130, 2.7, 180],
  ['rice brown', 'Brown rice, cooked', 'Arroz integral cocido', 'Vollkornreis, gekocht', 112, 2.6, 180],
  ['pasta', 'Pasta, cooked', 'Pasta cocida', 'Nudeln, gekocht', 158, 5.8, 200],
  ['quinoa', 'Quinoa, cooked', 'Quinoa cocida', 'Quinoa, gekocht', 120, 4.4, 180],
  ['oats', 'Oats', 'Avena', 'Haferflocken', 379, 13, 50],
  ['porridge', 'Porridge with milk', 'Avena con leche', 'Haferbrei mit Milch', 110, 4.5, 250],
  ['muesli', 'Muesli', 'Muesli', 'Müsli', 360, 9, 60],
  ['cornflakes', 'Corn flakes', 'Copos de maíz', 'Cornflakes', 378, 7, 40],
  ['bread white', 'White bread', 'Pan blanco', 'Weißbrot', 265, 9, 60],
  ['bread whole', 'Wholemeal bread', 'Pan integral', 'Vollkornbrot', 247, 13, 60],
  ['tortilla corn', 'Corn tortilla', 'Tortilla de maíz', 'Maistortilla', 218, 5.7, 30],
  ['tortilla wheat', 'Flour tortilla', 'Tortilla de harina', 'Weizentortilla', 310, 8, 45],
  ['bagel', 'Bagel', 'Bagel', 'Bagel', 257, 10, 90],
  ['croissant', 'Croissant', 'Cruasán', 'Croissant', 406, 8, 60],
  ['rice cake', 'Rice cake', 'Galleta de arroz', 'Reiswaffel', 387, 8, 10],
  // meat, fish, eggs
  ['chicken breast', 'Chicken breast, cooked', 'Pechuga de pollo cocida', 'Hähnchenbrust, gegart', 165, 31, 150],
  ['chicken thigh', 'Chicken thigh, cooked', 'Muslo de pollo cocido', 'Hähnchenschenkel, gegart', 209, 26, 150],
  ['turkey breast', 'Turkey breast, cooked', 'Pechuga de pavo', 'Putenbrust', 135, 30, 150],
  ['beef lean', 'Beef steak, lean', 'Bistec de res', 'Rindersteak, mager', 217, 26, 180],
  ['beef ground', 'Ground beef, cooked', 'Carne molida de res', 'Rinderhack, gebraten', 250, 26, 150],
  ['pork loin', 'Pork loin, cooked', 'Lomo de cerdo', 'Schweinelende', 196, 27, 150],
  ['ham', 'Ham', 'Jamón', 'Schinken', 145, 21, 40],
  ['bacon', 'Bacon', 'Tocino', 'Speck', 541, 37, 30],
  ['sausage', 'Sausage', 'Salchicha', 'Wurst', 301, 12, 100],
  ['salmon', 'Salmon, cooked', 'Salmón', 'Lachs', 206, 22, 150],
  ['tuna can', 'Tuna in water, canned', 'Atún en agua', 'Thunfisch im eigenen Saft', 116, 26, 100],
  ['white fish', 'White fish, cooked', 'Pescado blanco', 'Weißfisch', 105, 23, 150],
  ['shrimp', 'Shrimp, cooked', 'Camarones', 'Garnelen', 99, 24, 100],
  ['egg', 'Egg', 'Huevo', 'Ei', 143, 13, 55],
  ['egg white', 'Egg white', 'Clara de huevo', 'Eiweiß (Eiklar)', 52, 11, 33],
  // dairy and alternatives
  ['milk whole', 'Whole milk', 'Leche entera', 'Vollmilch', 61, 3.2, 250],
  ['milk skim', 'Skimmed milk', 'Leche descremada', 'Magermilch', 34, 3.4, 250],
  ['oat drink', 'Oat drink', 'Bebida de avena', 'Haferdrink', 46, 1, 250],
  ['soy drink', 'Soy drink', 'Bebida de soya', 'Sojadrink', 33, 3.3, 250],
  ['yogurt plain', 'Plain yogurt', 'Yogur natural', 'Naturjoghurt', 61, 3.5, 150],
  ['greek yogurt', 'Greek yogurt', 'Yogur griego', 'Griechischer Joghurt', 97, 9, 150],
  ['skyr', 'Skyr', 'Skyr', 'Skyr', 63, 11, 150],
  ['quark', 'Quark, low fat', 'Quark / requesón', 'Magerquark', 67, 12, 150],
  ['cottage cheese', 'Cottage cheese', 'Queso cottage', 'Hüttenkäse', 98, 11, 150],
  ['cheese', 'Cheese, hard', 'Queso', 'Käse', 402, 25, 30],
  ['mozzarella', 'Mozzarella', 'Mozzarella', 'Mozzarella', 280, 22, 60],
  ['butter', 'Butter', 'Mantequilla', 'Butter', 717, 0.9, 10],
  // legumes, nuts, seeds
  ['lentils', 'Lentils, cooked', 'Lentejas cocidas', 'Linsen, gekocht', 116, 9, 200],
  ['beans', 'Beans, cooked', 'Frijoles cocidos', 'Bohnen, gekocht', 127, 8.7, 200],
  ['chickpeas', 'Chickpeas, cooked', 'Garbanzos cocidos', 'Kichererbsen, gekocht', 164, 8.9, 200],
  ['tofu', 'Tofu', 'Tofu', 'Tofu', 144, 15, 150],
  ['hummus', 'Hummus', 'Hummus', 'Hummus', 166, 8, 50],
  ['almonds', 'Almonds', 'Almendras', 'Mandeln', 579, 21, 30],
  ['walnuts', 'Walnuts', 'Nueces', 'Walnüsse', 654, 15, 30],
  ['peanuts', 'Peanuts', 'Cacahuates', 'Erdnüsse', 567, 26, 30],
  ['peanut butter', 'Peanut butter', 'Crema de cacahuate', 'Erdnussbutter', 588, 25, 20],
  ['chia', 'Chia seeds', 'Semillas de chía', 'Chiasamen', 486, 17, 15],
  // fats, sweets, snacks
  ['olive oil', 'Olive oil', 'Aceite de oliva', 'Olivenöl', 884, 0, 10],
  ['honey', 'Honey', 'Miel', 'Honig', 304, 0.3, 20],
  ['sugar', 'Sugar', 'Azúcar', 'Zucker', 387, 0, 5],
  ['jam', 'Jam', 'Mermelada', 'Marmelade', 250, 0.4, 20],
  ['chocolate dark', 'Dark chocolate', 'Chocolate amargo', 'Zartbitterschokolade', 546, 7.8, 20],
  ['chocolate milk', 'Milk chocolate', 'Chocolate con leche', 'Vollmilchschokolade', 535, 7.7, 20],
  ['cookies', 'Cookies', 'Galletas', 'Kekse', 480, 6, 30],
  ['chips', 'Potato chips', 'Papas fritas de bolsa', 'Kartoffelchips', 536, 7, 30],
  ['ice cream', 'Ice cream', 'Helado', 'Eiscreme', 207, 3.5, 100],
  ['cake', 'Cake', 'Pastel', 'Kuchen', 370, 5, 100],
  ['protein bar', 'Protein bar', 'Barra de proteína', 'Proteinriegel', 360, 30, 60],
  ['whey', 'Whey protein powder', 'Proteína whey en polvo', 'Whey-Proteinpulver', 380, 78, 30],
  // dishes
  ['pizza', 'Pizza', 'Pizza', 'Pizza', 266, 11, 300],
  ['burger', 'Hamburger', 'Hamburguesa', 'Hamburger', 254, 13, 220],
  ['sandwich', 'Ham and cheese sandwich', 'Sándwich de jamón y queso', 'Schinken-Käse-Sandwich', 260, 14, 150],
  ['tacos', 'Tacos', 'Tacos', 'Tacos', 226, 9, 100],
  ['burrito', 'Burrito', 'Burrito', 'Burrito', 206, 9, 250],
  ['sushi', 'Sushi', 'Sushi', 'Sushi', 150, 6, 200],
  ['schnitzel', 'Schnitzel', 'Milanesa', 'Schnitzel', 260, 18, 180],
  ['soup veg', 'Vegetable soup', 'Sopa de verduras', 'Gemüsesuppe', 40, 1.5, 300],
  ['spaghetti bolognese', 'Spaghetti bolognese', 'Espagueti a la boloñesa', 'Spaghetti Bolognese', 150, 7, 350],
  // drinks
  ['coffee black', 'Black coffee', 'Café negro', 'Schwarzer Kaffee', 2, 0.1, 200],
  ['cappuccino', 'Cappuccino', 'Capuchino', 'Cappuccino', 40, 2, 200],
  ['orange juice', 'Orange juice', 'Jugo de naranja', 'Orangensaft', 45, 0.7, 250],
  ['cola', 'Cola', 'Refresco de cola', 'Cola', 42, 0, 330],
  ['beer', 'Beer', 'Cerveza', 'Bier', 43, 0.5, 330],
  ['wine', 'Wine', 'Vino', 'Wein', 83, 0.1, 150],
  ['smoothie', 'Fruit smoothie', 'Licuado de frutas', 'Frucht-Smoothie', 55, 0.8, 300],
]

const COL = { en: 1, es: 2, de: 3 }
const fold = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

/** Every basic food as { id, name, kcal100, protein100, serving } in language `lang` (English otherwise). */
export function basicFoods(lang = 'en') {
  const c = COL[lang] || 1
  return ROWS.map(r => ({ id: 'basic:' + r[0], name: r[c], en: r[1], kcal100: r[4], protein100: r[5], serving: r[6], basic: true }))
}

/**
 * Basic foods matching `q`, best first: every word of the query has to start a word of the name
 * (in the reader's language or in English), and a name that starts with the query ranks first.
 */
export function searchBasic(q, lang = 'en', limit = 8) {
  const words = fold(q).split(/[^a-z0-9ñ]+/).filter(Boolean)
  if (!words.length) return []
  const hits = []
  for (const f of basicFoods(lang)) {
    const names = [fold(f.name), fold(f.en)]
    const ok = names.some(n => { const ws = n.split(/[^a-z0-9ñ]+/); return words.every(w => ws.some(x => x.startsWith(w))) })
    if (!ok) continue
    const score = names.some(n => n.startsWith(words.join(' '))) ? 0 : 1
    hits.push({ f, score })
  }
  return hits.sort((a, b) => a.score - b.score || a.f.name.length - b.f.name.length).slice(0, limit).map(h => h.f)
}
