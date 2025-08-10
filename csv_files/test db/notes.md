# DB Revision Notes

## Improvements:

I suggest we make the following changes.

- Have a join table CSV file like `ships_weapons.csv` that links ships and
  weapons instead of listing weapon names in a JSON-like array in `ships.csv`.  
  Example:
  ```csv
  ship_id,weapon_id
  0,1
  0,2
  1,2
  1,4
  1,5 
  ```
  (Do the same for defenses - `ship_defenses.csv`)

## Stretch Goals - avoid implementing unless there's time

Collect this data now if given the opportunity, otherwise, don't go out
of your way to get it. We can either make it up or find the data later.

- Ships:
    - Speed/Maneuverability (speed would be the ship's max sub-light speed, not
      warp)
    - Shield recharge rate
    - Ship size (this, along with distance from attacking ship, would affect
      weapon accuracy. It could also determine how ships are displayed if we
      display ships visually in battle on the front-end)
- Weapons:
    - Accuracy
    - Energy Cost
    - Area of Effect (especially for explosive weapons like torpedoes)
- Defenses:
    - todo
- Miscellaneous: (not for the database, but I figured I put these here as well)
    - Add background music for main menu and battle simulation
    - Add SFX for battle simulation
    - Add UI SFX

## Considerations:

Here's some things to think about that could affect how we use/format the
database.

- Either make the simulation turn-based or add weapon cooldowns
- How is the battle simulation going to be displayed on the front-end?
    - Perhaps text-only with a ship details GUI and/or health bars on the side
    - Stretch goal: actually show the ships moving around & firing at each other
- Should we allow letting the user mix and match ship systems (weapons &
  defenses), or should we lock them to the ship canonically associated with
  them?
- In the `ships_weapons.csv` join table, consider adding a 3rd column: `count`.
  - For example, if the ship with ID `1` has 6 phaser arrays (say, ID `2`), it
    would show up as `1,2,6`. This may work differently for torpedoes though,
    since you'd have a different number of torpedo launchers than actual
    torpedoes, and there may not be any "Torpedo Launcher" weapon, but rather
    "Photon Torpedoes", "Quantum Torpedoes", etc.
  - Consider adding a "Torpedo Launchers" stat to ships.
- We should try to have at least two or three ships from at least 5 different
  affiliations (i.e. Federation, Klingon, Romulan, Cardassian, Dominion, etc.).
  I would remove the Borg cube unless we're going to allow multiple ships to
  engage it at once, as Borg cubes are incredibly powerful and diffucult to
  destroy. A Borg sphere might be a better match for 1v1 battles though.
- Consider making weapons and defenses more generic. For example, instead of
  having "Romulan Cloaking Device," "Klingon Cloaking Device," and "Dominion
  Cloaking Device," maybe merge them all into one regular "Cloaking Device" and
  perhaps get rid of the defense type, as the name and type would basically be
  the same at this point. Yes, I know changes like this will make scrapping the
  data harder and/or require more manual editing. I (Daniel) am willing to make
  lots of manual edits to the data in order to achieve this as long as our
  database doesn't get massive.
- Consider removing "special_effects" from `defenses.csv`, and instead have the
  API determine what each defense's effect is from its ID.

## Current Format Notes:

### `defenses.csv`:

The "effectiveness" column can work differently depending on the type of defense
or special effect(s). For example, for type  "Shields" or special effect
"Shielding," `effectiveness` defines how much damage the shields deflect from
the hull (where 0 is none and 1 is 100%). For Cloaks, `effectiveness` defines
how effective the cloak is to sensors (where 0 is not at all and 1 is 100%).
I'm not sure how or even if we would implement that though. We may need to
rethink the `effectiveness` stat, how we define what different defenses do, and
how different defenses can be activated/deactivated and damaged/disabled.
