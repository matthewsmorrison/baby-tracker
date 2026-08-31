# NHS guidance audit
Generated 2026-08-31 by scripts/audit-nhs-guidance.mjs.

Compare each source extract against the app constants beneath it.
Numbers that differ need a reviewed change to lib/clinical.ts AND
ios/Beanlo/Clinical.swift AND their unit tests (see the add-guidance
skill and the TDD rule in AGENTS.md). Never change numbers the extract
doesn't support.

## Nappy counts (wet & dirty) as a sign of enough milk

Source: https://www.nhs.uk/baby/breastfeeding-and-bottle-feeding/breastfeeding-problems/enough-milk/

### Source extracts

> …babies to lose some of their birth weight in the first 3 to 4 days. They appear healthy and alert when they're awake. From the fourth day, they should do at least 2 soft, yellow poos the size of a £2 coin every day for the first few weeks. From day 5 onwards, wet nappies should start to become more frequent, with at least 6 heavy, wet nappies every 24 hours. In the first 48 hours, your baby is likely to have only 2 or 3 wet nappies. It can be hard to tell if disposable nappies are wet. To get an idea, take an unuse…

> …weight steadily after the first 3 to 4 days – it's normal for babies to lose some of their birth weight in the first 3 to 4 days. They appear healthy and alert when they're awake. From the fourth day, they should do at least 2 soft, yellow poos the size of a £2 coin every day for the first few weeks. From day 5 onwards, wet nappies should start to become more frequent, with at least 6 heavy, wet nappies every 24 hours. In the first 48 hours, your baby is likely to have only 2 or 3 wet nappies. It can be hard to te…

> …r both breasts at each feed and alternate which breast you start with. Keep your baby close to you and hold them skin to skin. This will help you spot signs your baby is ready to feed early on, before they start crying. Things that can affect your milk supply Poor attachment and positioning. Not feeding your baby often enough or not offering them your breast whenever they show signs they're hungry. Drinking alcohol and smoking while breastfeeding – these can both interfere with your milk production. Previous breast…

### App currently says

```
export function expectedNappies(day: number): NappyExpectation {
  if (day <= 2)
    return {
      total: 3,
      minDirty: 1,
      wetLabel: "2+",
      dirtyLabel: "1+ meconium",
      note: "Meconium (dark, sticky) is normal now.",
    };
  if (day <= 4)
    return {
      total: 5,
      minDirty: 2,
      wetLabel: "3+",
      dirtyLabel: "2+ (≥ £2 coin)",
      note: "Poo changing to green ‘changing stools’ as milk comes in.",
    };
  if (day <= 6)
    return {
      total: 7,
      minDirty: 2,
      wetLabel: "5+ heavy",
      dirtyLabel: "2+ soft yellow (≥ £2 coin)",
      note: "No more meconium — soft yellow poos, at least £2-coin sized.",
    };
  if (day >= 42)
    // NHS: from 6 weeks the steady guide is 6+ heavy wet nappies/24h, and
    // breastfed babies can go days (even a week) between poos — soft when
    // it comes is what matters, so no dirty minimum.
    return {
      total: 6,
      minDirty: 0,
      wetLabel: "6+ heavy",
      dirtyLabel: "soft when it comes",
      note: "6+ heavy wet nappies a day. Breastfed babies can now go days between poos — soft when it comes is what matters.",
    };
  return {
    total: 8,
    minDirty: 2,
    wetLabel: "6+ heavy",
    dirtyLabel: "2+ (> £2 coin)",
    note: "At least two good yellow poos a day — bigger than a £2 coin, not just skid marks.",
  };
}

export const STOOL_COLOURS: Record<
  StoolColourKey,
  { label: string; swatch: string; warn?: boolean }
> = {
  meconium: { label: "Meconium (black-green)", swatch: "#2E2E28" },
  transitional: { label: "Transitional (green-brown)", swatch: "#6E5A34" },
  yellow: { label: "Yellow (breastfed)", swatch: "#E3B44A" },
  tan: { label: "Tan (formula/mixed)", swatch: "#BFA173" },
  brown: { label: "Brown (formula)", swatch: "#7A5A3A" },
  green: { label: "Green", swatch: "#5C7A3A" },
  pale: { label: "Pale / chalky ⚠", swatch: "#ECE7D6", warn: true },
  blood: { label: "Blood ⚠", swatch: "#9E3B32", warn: true },
};

/**
```

## Breastfed poo frequency from ~6 weeks

Source: https://www.nhs.uk/best-start-in-life/baby/feeding-your-baby/breastfeeding/breastfeeding-challenges/constipation/

### Source extracts

> …your baby may be less hungry than usual their tummy might feel firm Other signs of constipation can include your baby lacking energy and being a bit grumpy. How often should my baby poo? Because breastmilk is a natural laxative, a baby aged between 4 days and 6 weeks who is breastfeeding well should pass at least 2 yellow poos a day. If your baby has not pooed in the past 24 to 48 hours, speak to your midwife or health visitor as this may mean they are not getting enough milk. In the beginning, your baby will pass…

> …s page Symptoms of constipation How often should my baby poo? Causes of constipation Tips on treating constipation Help and support Sign up for emails Symptoms of constipation The symptoms of constipation in your baby can include: pooing fewer than 3 times in a week finding it difficult to poo, and poos that are larger than usual dry, hard, lumpy or pellet-like poos unusually smelly wind and poo your baby may be less hungry than usual their tummy might feel firm Other signs of constipation can include your baby lac…

> …Constipation - Breastfeeding - Best Start in Life - NHS Skip to main content NHS Best Start in Life home NHS logo Search the NHS website Search NHS logo Pregnancy Baby Toddler Childcare and education support (external) Home Baby Feeding your baby Breastfeeding…

### App currently says

```
  if (day >= 42)
    // NHS: from 6 weeks the steady guide is 6+ heavy wet nappies/24h, and
    // breastfed babies can go days (even a week) between poos — soft when
    // it comes is what matters, so no dirty minimum.
    return {
      total: 6,
      minDirty: 0,
      wetLabel: "6+ heavy",
      dirtyLabel: "soft when it comes",
      note: "6+ heavy wet nappies a day. Breastfed babies can now go days between poos — soft when it comes is what matters.",
    };
  return {
    total: 8,
    minDirty: 2,
```

## Feeds per 24h in the early weeks

Source: https://www.nhs.uk/baby/breastfeeding-and-bottle-feeding/breastfeeding/the-first-few-days/

### Source extracts

> …may want to feed very often. It could be every hour in the first few days. Feed your baby as often as they want and for as long as they want. They'll begin to have fewer, but longer feeds after a few days. As a very rough guide, your baby should feed at least 8 to 12 times, or more, every 24 hours during the first few weeks. It's fine to feed your baby whenever they are hungry, when your breasts feel full or if you just want to have a cuddle. It's not possible to overfeed a breastfed baby. When your baby is hungry…

> …ies with breastfeeding, take a look at common breastfeeding problems . Ask a midwife or health visitor for help. They can also tell you about other breastfeeding support available near you. Call the National Breastfeeding Helpline 24 hours a day on 0300 100 0212. Get Best Start in Life pregnancy and baby emails Sign up for Best Start in Life emails for expert advice, videos and tips on pregnancy, birth and beyond. More in How to breastfeed Breastfeeding: the first few days Breastfeeding: positioning and attachment…

> …Breastfeeding: the first few days - NHS Skip to main content NHS Search the NHS website Search Health A to Z NHS services Healthy living Mental health Care and support Browse More Home Baby Breastfeeding and bottle feeding advice How to breastfeed Back to How to bre…

### App currently says

```
export const EXPECTED_FEEDS = { min: 8, max: 12, label: "8–12" };

/**
```

## Newborn weight loss and regain

Source: https://www.nhs.uk/baby/breastfeeding-and-bottle-feeding/breastfeeding-problems/enough-milk/

### Source extracts

> …ent and satisfied after most feeds. Your breasts feel softer after feeds. Your nipple looks more or less the same after feeds – not flattened, pinched or white. You may feel sleepy and relaxed after feeds. Other signs your baby is feeding well Your baby gains weight steadily after the first 3 to 4 days – it's normal for babies to lose some of their birth weight in the first 3 to 4 days. They appear healthy and alert when they're awake. From the fourth day, they should do at least 2 soft, yellow poos the size of a £…

### App currently says

```
const REGAIN_DAY = 21;
const WEEKLY_GAIN_G = 175; // midpoint of 150–200 g/week once regained

export function expectedWeightBand(
  day: number,
  birthWeightG: number
): { low: number; mid: number; high: number } {
  let mid: number;
```

## High temperature threshold in babies

Source: https://www.nhs.uk/symptoms/fever-in-children/

### Source extracts

> …ren A high temperature (fever) is very common in young children. The temperature usually returns to normal within 1 to 4 days. Checking a high temperature A normal temperature in babies and children can vary slightly from child to child. A high temperature is 38C or more. If your child has a high temperature, they might: feel hotter than usual when you touch their back or chest feel sweaty look or feel unwell have a seizure or fit, called a febrile seizure Use a digital thermometer, which you can buy from pharmacie…

> …ckenpox, or is dehydrated do not give ibuprofen to children with asthma unless it&#x27;s been recommended by a doctor Read more about giving medicines to babies and children Urgent advice: Call 111 if your child: is under 3 months old and has a temperature of 38C or higher, or you think they have a high temperature is 3 to 6 months old and has a temperature of 39C or higher, or you think they have a high temperature has other signs of illness, such as a rash , as well as a high temperature has a high temperature th…

> …High temperature (fever) in children - NHS Skip to main content NHS Search the NHS website Search Health A to Z NHS services Healthy living Mental health Care and support Browse More Home Health A to Z Symptoms A to Z Back to Symptoms A to Z Back High temperature (…

> …hes do not give aspirin to children under 16 years of age do not alternate ibuprofen and paracetamol, unless a health professional such as a doctor or nurse tells you to do not give paracetamol to a child under 2 months do not give ibuprofen to a child who is under 3 months, weighs under 5kg, has chickenpox, or is dehydrated do not give ibuprofen to children with asthma unless it&#x27;s been recommended by a doctor Read more about giving medicines to babies and children Urgent advice: Call 111 if your child: is und…

### App currently says

```
(anchor "38" not found in lib/clinical.ts)
```

## Safe sleep basics

Source: https://www.nhs.uk/conditions/sudden-infant-death-syndrome-sids/

### Source extracts

> …Sudden infant death syndrome (SIDS) - NHS Skip to main content NHS Search the NHS website Search Health A to Z NHS services Healthy living Mental health Care and support Browse More Home Baby Caring for a newborn baby Back to Caring for a newborn baby Back Sudden infant death syndrome (SIDS) Sudden infant death syndrome (SIDS) is the sudden and unexplained death of an apparently healthy baby aged up to 12 months old. It used to be called cot death. What causes sudden infant…

> …risk of sudden infant death syndrome (SIDS). Follow this advice whenever your baby is sleeping. If your baby was born prematurely, follow the advice for safer sleep for a year from their due date not the date they were born. Do always place your baby on their back to sleep in the feet-to-foot position – this means with their feet at the bottom of the cot, Moses basket or pram move your baby onto their back if they roll (until they can roll onto their front and back again by themselves) place your baby in a separate…

> ….5lb when they were born do not share a bed with your baby if you or your partner smoke, drink alcohol or take drugs or medicine that makes you feel sleepy (drowsy) do not let your baby get too hot or too cold – make sure that your baby&#x27;s room is between 16C to 20C do not let your baby stay in a car seat for too long – it&#x27;s ok for your baby to fall asleep in a car seat while you are travelling, but take your baby out of the car seat as soon as you get to where you&#x27;re going Information: Find out more…

> …hing, or because the room is too hot. Check your baby's temperature by feeling their chest or the back of their neck. Do not worry if their hands or feet feel cool, this is normal. To reduce the risk of SIDS: keep the room at a temperature between about 16 to 20C – monitor the temperature using a room thermometer remove 1 or more layers of clothing or bedding if your baby skin is hot or sweating use lightweight blankets, sheets or a baby sleeping bag remove hats and extra clothing as soon as you come indoors or ent…

> …ction against childhood illnesses that may increase the risk of SIDS Don&#x27;t do not sleep on a sofa or in an armchair with your baby do not smoke when you&#x27;re pregnant or around your baby after they&#x27;re born, and do not let anyone smoke in the same room as your baby do not share a bed with your baby if they were born prematurely (before 37 weeks of pregnancy) or if they weighed less than 2.5kg or 5.5lb when they were born do not share a bed with your baby if you or your partner smoke, drink alcohol or ta…

> …o be called cot death. What causes sudden infant death syndrome (SIDS)? Sudden infant death syndrome (SIDS) is rare, but it does still happen. It's not known what causes SIDS. But certain things can increase the risk of SIDS, like exposing a baby to cigarette smoke or sleeping with them on a sofa or chair. Babies born early (before 37 weeks) or with a low birth weight (less than 2.5kg or 5.5lb) are more at risk of SIDS. So twins and multiples are more at risk of SIDS. SIDS is more likely to happen in the first 6 mo…

### App currently says

```
export const RED_FLAGS: string[] = [
  "Pale, white or chalky stool at any age — contact your midwife or GP today",
  "Blood in the nappy (in stool or urine) — seek advice today",
  "Meconium (black, tarry) stool still appearing at day 5 or later",
  "Fewer wet nappies than expected for the day, or dark/strong urine after day 4",
  "Weight loss of more than 10% from birth weight",
  "Baby unusually sleepy, floppy, or hard to wake for feeds",
  "Fewer than 6 feeds in 24 hours, or refusing feeds",
  "Jaundice that is worsening, or a jaundiced baby who is sleepy and feeding poorly",
  "Dry mouth, sunken fontanelle, or no tears when crying",
];

/**
 * A used nappy this much heavier than a dry one counts as wet. Not a clinical
 * threshold — just a floor above scale noise (1 g ≈ 1 ml of urine).
 */
export const NAPPY_WET_THRESHOLD_G = 15;

/** Grams of output in a used nappy, when the dry base weight is known. */
export function nappyOutputG(
```
