/**
 * Aliases map to exact canonical names from prisma/seeds/ingredients/*.
 * aliasNormalized is computed at seed time via the same normalizer as the app.
 */

export const INGREDIENT_ALIAS_GROUPS: { canonicalName: string; aliases: string[] }[] =
  [
    {
      canonicalName: "Cilantro",
      aliases: [
        "coriander leaves",
        "fresh coriander",
        "chinese parsley",
        "cilantr",
      ],
    },
    {
      canonicalName: "Scallion",
      aliases: [
        "green onion",
        "green onions",
        "spring onion",
        "spring onions",
        "welsh onion",
      ],
    },
    {
      canonicalName: "Eggplant",
      aliases: ["aubergine", "brinjal"],
    },
    {
      canonicalName: "Arugula",
      aliases: ["rocket", "rucola"],
    },
    {
      canonicalName: "Heavy Cream",
      aliases: ["whipping cream", "double cream"],
    },
    {
      canonicalName: "All-Purpose Flour",
      aliases: ["plain flour", "ap flour"],
    },
    {
      canonicalName: "Confectioners Sugar",
      aliases: ["powdered sugar", "icing sugar"],
    },
    {
      canonicalName: "Kosher Salt",
      aliases: ["coarse salt", "koshering salt"],
    },
    {
      canonicalName: "Extra Virgin Olive Oil",
      aliases: ["evoo", "olive oil extra virgin"],
    },
    {
      canonicalName: "Soy Sauce",
      aliases: ["shoyu", "soya sauce"],
    },
    {
      canonicalName: "Rice Vinegar",
      aliases: ["rice wine vinegar"],
    },
    {
      canonicalName: "Bell Pepper",
      aliases: ["capsicum", "sweet pepper"],
    },
    {
      canonicalName: "Zucchini",
      aliases: ["courgette", "courgettes"],
    },
    {
      canonicalName: "Shrimp",
      aliases: ["prawn", "prawns"],
    },
    {
      canonicalName: "Ground Beef",
      aliases: ["minced beef", "beef mince", "hamburger meat"],
    },
    {
      canonicalName: "Baking Soda",
      aliases: ["bicarbonate of soda", "bicarb"],
    },
    {
      canonicalName: "Cornstarch",
      aliases: ["corn starch", "cornflour"],
    },
    {
      canonicalName: "Cane Sugar",
      aliases: ["white sugar", "granulated sugar"],
    },
    {
      canonicalName: "Brown Sugar",
      aliases: ["light brown sugar", "dark brown sugar"],
    },
    {
      canonicalName: "Chicken Stock",
      aliases: ["chicken broth"],
    },
    {
      canonicalName: "Vegetable Stock",
      aliases: ["vegetable broth"],
    },
    {
      canonicalName: "Lemon Juice",
      aliases: ["fresh lemon juice"],
    },
    {
      canonicalName: "Lime Juice",
      aliases: ["fresh lime juice"],
    },
    {
      canonicalName: "Parmesan Cheese",
      aliases: ["parmigiano", "parmesan", "parm"],
    },
    {
      canonicalName: "Yogurt",
      aliases: ["yoghurt", "plain yogurt"],
    },
  ];
