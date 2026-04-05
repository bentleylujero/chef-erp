/**
 * Detects named foods in recipe title/description (and optionally steps) that are not
 * reflected by any ingredient name — e.g. "Tomato Basil Rigatoni" without basil stocked.
 */

const STOPWORDS = new Set(
  [
    "the", "and", "with", "from", "into", "this", "that", "your", "for", "are",
    "was", "you", "our", "any", "all", "its", "one", "two", "how", "way",
    "heat", "over", "under", "medium", "high", "low", "until", "then", "each",
    "side", "about", "minutes", "minute", "hour", "hours", "serve", "serving",
    "plate", "bowl", "fresh", "lightly", "well", "large", "small", "thin",
    "thick", "recipe", "style", "classic", "quick", "easy", "simple", "rustic",
    "cooked", "golden", "brown", "browned", "tender", "crisp", "crispy", "soft",
    "warm", "cold", "hot", "boil", "boiled", "simmer", "simmered", "chopped",
    "diced", "minced", "sliced", "grated", "whole", "piece", "pieces", "make",
    "made", "using", "add", "adding", "mix", "stir", "combine", "place",
    "transfer", "return", "remove", "drain", "season", "seasoned", "taste",
    "adjust", "garnish", "optional", "prepare", "prepared", "oven", "stove",
    "skillet", "sheet", "baking", "toasted", "toasting", "italian", "french",
    "mexican", "thai", "indian", "chinese", "japanese", "korean", "mediterranean",
    "traditional", "creamy", "rich", "light", "bright", "savory", "sweet",
    "tangy", "smoky", "spicy", "mild", "dinner", "lunch", "breakfast", "meal",
    "dish", "perfect", "favorite", "favourite", "delicious", "topped", "tossed",
    "drizzle", "drizzled", "finish", "finished", "rest", "let", "set", "cut",
    "trim", "pat", "dry", "rinse", "wash", "peel", "seed", "core", "halve",
    "quarter", "cube", "julienne", "whisk", "fold", "roll", "spread", "layer",
    "brush", "coat", "marinate", "reduce", "deglaze", "skim", "strain", "cool",
    "chill", "freeze", "melt", "warm", "toast", "broil", "bake", "roast", "fry",
    "deep", "sear", "braise", "stew", "steam", "poach", "blanch", "grill",
    "smoke", "cure", "pickle", "ferment", "blend", "puree", "process", "grind",
    "crush", "smash", "mash", "whip", "beat", "knead", "resting", "room",
    "temperature", "preheated", "degrees", "fahrenheit", "celsius", "sheet",
    "lined", "greased", "nonstick", "stick", "cast", "iron", "dutch", "stock",
    "broth", "wine", "vinegar", "sauce", "glaze", "reduction", "emulsion",
    "dressing", "vinaigrette", "marinade", "rub", "spice", "blend", "mixture",
    "batch", "portion", "yield", "serves", "servings", "prep", "cook", "total",
    "time", "times", "step", "steps", "first", "next", "finally", "while",
    "once", "after", "before", "during", "between", "among", "both", "either",
    "neither", "other", "another", "such", "same", "very", "just", "only",
    "also", "even", "still", "again", "back", "down", "out", "off", "up",
    "away", "aside", "together", "apart", "half", "full", "double", "single",
    "triple", "extra", "more", "less", "least", "most", "some", "many", "few",
    "bit", "touch", "dash", "pinch", "sprinkle",     "generous", "salt",
    "black", "white", "ground", "kosher", "flake", "flakes", "water", "ice",
    "boiling", "simmering", "rolling", "bubbles", "bubble", "fork", "knife",
    "spoon", "ladle", "tongs", "whisk", "bowl", "board", "towel", "paper",
    "foil", "wrap", "cover", "lid", "uncover", "flip", "turn", "rotate",
    "shake", "toss", "coat", "evenly", "smooth", "rough", "fine", "coarse",
    "thick", "thin", "smooth", "cream", "silky", "velvety", "buttery", "nutty",
    "earthy", "bright", "freshly", "roughly", "finely", "thinly", "thickly",
    "diagonally", "lengthwise", "crosswise", "against", "grain", "bias",
    "reserved", "divided", "plus", "minus", "approx", "about", "roughly",
  ].map((w) => w.toLowerCase()),
);

/** Foods that often appear in titles but must match an ingredient name (substring). */
const NAMED_FOOD_LEXICON = new Set(
  [
    "basil", "oregano", "thyme", "rosemary", "parsley", "cilantro", "coriander",
    "dill", "mint", "sage", "tarragon", "marjoram", "chives", "lemongrass",
    "turmeric", "cumin", "paprika", "saffron", "nutmeg", "cinnamon", "clove",
    "cloves", "cardamom", "fenugreek", "harissa", "sumac", "chipotle",
    "jalapeno", "jalapeño", "poblano", "serrano", "habanero", "ginger",
    "shallot", "shallots", "scallion", "scallions", "chive", "anise", "star",
    "fennel", "wasabi", "horseradish", "mustard", "sesame", "poppy", "caraway",
    "chicken", "beef", "pork", "lamb", "duck", "turkey", "veal", "bison",
    "bacon", "sausage", "chorizo", "prosciutto", "pancetta", "salami",
    "pepperoni", "mortadella", "capicola", "anchovy", "anchovies", "sardine",
    "sardines", "salmon", "trout", "cod", "halibut", "tilapia", "mackerel",
    "tuna", "shrimp", "prawn", "prawns", "scallop", "scallops", "mussel",
    "mussels", "clam", "clams", "oyster", "oysters", "lobster", "crab",
    "squid", "calamari", "octopus", "tofu", "tempeh", "seitan", "edamame",
    "spinach", "kale", "arugula", "lettuce", "romaine", "broccoli", "cauliflower",
    "zucchini", "eggplant", "aubergine", "mushroom", "mushrooms", "shiitake",
    "portobello", "cremini", "truffle", "avocado", "mango", "pineapple",
    "coconut", "pomegranate", "fig", "figs", "apricot", "peach", "peaches",
    "pear", "pears", "apple", "apples", "grape", "grapes", "blueberry",
    "blueberries", "strawberry", "strawberries", "raspberry", "raspberries",
    "blackberry", "blackberries", "lemon", "lime", "orange", "grapefruit",
    "celery", "carrot", "carrots", "beet", "beets", "radish", "radishes",
    "turnip", "turnips", "parsnip", "parsnips", "squash", "pumpkin", "potato",
    "potatoes", "yam", "yams", "corn", "peas", "chickpea", "chickpeas",
    "lentil", "lentils", "artichoke", "artichokes", "caper", "capers", "olive",
    "olives", "asparagus", "leek", "leeks", "onion", "onions", "garlic",
    "tomato", "tomatoes", "pepper", "peppers", "bell", "poblano", "anaheim",
    "mascarpone", "ricotta", "burrata", "feta", "mozzarella", "provolone",
    "parmesan", "pecorino", "gruyere", "gruyère", "gorgonzola", "fontina",
    "cheddar", "swiss", "brie", "camembert", "halloumi", "paneer", "quark",
    "yogurt", "yoghurt", "buttermilk", "creme", "crème", "fraiche", "fraîche",
    "goat",
    "risotto", "gnocchi", "couscous", "quinoa", "farro", "barley", "polenta",
    "pho", "ramen", "udon", "soba", "naan", "pita", "tortilla", "tortillas",
    "rigatoni", "penne", "fusilli", "spaghetti", "linguine", "fettuccine",
    "bucatini", "orzo", "tortellini", "ravioli", "lasagna", "lasagne",
    "macaroni", "cavatappi", "orecchiette", "tagliatelle", "pappardelle",
    "angel", "hair", "vermicelli", "noodle", "noodles", "rice", "brown",
    "jasmine", "basmati", "arborio", "sushi", "sticky", "wild",
  ].map((w) => w.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase()),
);

export function tokenizeLowerWords(text: string): string[] {
  const t = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
  return t.match(/\b[a-z]{3,}\b/g) ?? [];
}

export function ingredientCoversToken(
  ingredientNames: string[],
  token: string,
): boolean {
  const w = token.toLowerCase();
  if (w.length < 3) return true;
  for (const n of ingredientNames) {
    const nl = n
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{M}/gu, "");
    if (nl.includes(w)) return true;
    if (w.length >= 4 && nl.length >= 4 && w.includes(nl)) return true;
  }
  return false;
}

export function findLexiconMismatches(
  blob: string,
  ingredientNames: string[],
): string[] {
  const words = tokenizeLowerWords(blob);
  const seen = new Set<string>();
  const reasons: string[] = [];

  for (const raw of words) {
    const w = raw.toLowerCase();
    if (STOPWORDS.has(w)) continue;
    if (!NAMED_FOOD_LEXICON.has(w)) continue;
    if (ingredientCoversToken(ingredientNames, w)) continue;
    if (seen.has(w)) continue;
    seen.add(w);
    reasons.push(w);
  }

  return reasons;
}

export function collectInstructionBlob(instructions: unknown): string {
  if (!Array.isArray(instructions)) return "";
  const parts: string[] = [];
  for (const step of instructions) {
    if (step && typeof step === "object") {
      const o = step as Record<string, unknown>;
      if (typeof o.step === "string") parts.push(o.step);
      else if (typeof o.text === "string") parts.push(o.text);
      if (typeof o.notes === "string") parts.push(o.notes);
    }
  }
  return parts.join(" ");
}

export function auditRecipeTextVsIngredients(input: {
  title: string;
  description: string;
  instructions?: unknown;
  ingredientNames: string[];
  scanInstructions: boolean;
}): { mismatches: string[] } {
  let blob = `${input.title} ${input.description}`;
  if (input.scanInstructions) {
    blob += ` ${collectInstructionBlob(input.instructions)}`;
  }
  const mismatches = findLexiconMismatches(blob, input.ingredientNames);
  return { mismatches };
}
