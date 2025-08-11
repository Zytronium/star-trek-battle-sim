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

----

## Target List of Ships

Here's a table of ships I would like us to have in the database at minimum if
possible, along with some data that I either already know or was able to find.
I will also try to limit ships to roughly the same time period (late 24th century).

| Name              | Registry    | Class                   | Owner                                      | Notes/Description                                                                                                                                                                                                                                                                                                                                                                                                                     | Weapons                                                                   | Defenses                                 | Image                                                                                                                                       |
|-------------------|-------------|-------------------------|--------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|---------------------------------------------------------------------------|------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------|
| USS Enterprise-D  | NCC-1701-D  | Galaxy                  | United Federation of Planets               | Enterprise D was the 5th iteration of the USS Enterprise,the flagship of the Federation in Star Trek: The Next Generation.                                                                                                                                                                                                                                                                                                            | Phaser Array, Photon Torpedoes, Quantum Torpedoes                         | Shields                                  | ![USS Enterprise-D](https://vignette1.wikia.nocookie.net/memory-gamma/images/3/30/Enterprise_D_fore.jpg/revision/latest?cb=20120224220747)  |
| USS Pegasus       | NCC-53847   | Oberth                  | United Federation of Planets               | The USS Pegasus was a prototype vessel that served as a testbed for various technologies, including an illegal phasing cloaking device. The Pegasus was lost in 2358 in an accident while testing the phasing cloaking device.                                                                                                                                                                                                        | Phaser Array, Photon Torpedoes (?)                                        | Shields, Phasing Cloaking Device         | ![USS Pegasus](https://share.zytronium.dev/images/pegasus.webp)                                                                             |
| USS Voyager       | NCC-74656   | Intrepid                | United Federation of Planets               | Voyager was the first of its class, assigned to a 1-week mission, but ended up stranded in the Delta quadrant for years.                                                                                                                                                                                                                                                                                                              | Phaser Array, Spatial charges, Photon Torpedoes, Tricobalt warheads       | Shields                                  | ![USS Voyager](https://static0.gamerantimages.com/wordpress/wp-content/uploads/2023/11/star-trek-uss-voyager-cruising.jpg)                  |
| USS Defiant       | NX-74205    | Defiant                 | United Federation of Planets               | The Defiant was initially a prototype warship. Smaller than the average starship, Defiant was fast, agile, powerful, and later had a Romulan cloaking device for use in the Dominion war.                                                                                                                                                                                                                                             | Phaser Cannons, Phaser Array, Photon Torpedoes, Quantum Torpedoes         | Shields, Ablative Armor, Cloaking Device | ![USS Defiant](https://trekcentral.net/wp-content/uploads/2021/01/86821d81eb3f105941503d40f763f863.jpg)                                     |
| ISS Defiant       | NX-74205    | Defiant                 | Terran Resistance Forces (Mirror Universe) | The ISS Defiant, not to be confused with the USS Defiant (NX-74205) or the older USS Defiant (NCC-1764)                                                                                                                                                                                                                                                                                                                               | Phaser Cannons, Phaser Array, Photon Torpedoes, Quantum Torpedoes         | Shields, Armor                           | ![ISS Defiant](https://www.previewsworld.com/SiteImage/CatalogImage/STL037992?type=1)                                                       |
| ISS Charon        | Unknown     | Charon                  | Terran Empire (Mirror Universe)            | The ISS Charon was the flagship of the Terran Empire in the Terran universe. While this ship is over 100 years older than other ships listed, it has considerable fire power and a unique power source. The Charon houses the palace of the Terran emperor before she was taken to the prime universe.                                                                                                                                |                                                                           |                                          | ![ISS Charon](https://4.bp.blogspot.com/-yJf_uD0IGWw/Wm3Q-449cxI/AAAAAAAANBI/4Fb5nBk6dIMJUvg8ulYIJVdJBlHI5h2nQCKgBGAs/s1600/ISS-Charon.png) |
| IKS Ch'Tang       | IKC-9237    | Bird of Prey            | Klingon Empire                             | The Ch'Tang was General Martok's command ship during his raid on Trelka V in 2375.                                                                                                                                                                                                                                                                                                                                                    | Disruptor Cannons, Phaser Array, Photon Torpedoes                         | Shields, Cloaking Device                 | ![Bird of Pray](https://wiki.fed-space.com/images/6/60/Klingon_Bird-of-Prey.jpg)                                                            |
| IKS Negh'Var      | IKS-7500    | Negh'Var Warship        | Klingon Empire                             | Launched in the early 2370s, it was the first Negh'Var warship in the fleet, and served as the flagship of the Klingon Empire.                                                                                                                                                                                                                                                                                                        | Disruptors, Photon Torpedoes                                              | Shields, Cloaking Device                 | ![IKS Negh'Var](https://www.ex-astris-scientia.org/articles/neghvar/neghvar-wotw1.jpg)                                                      |
| Belak             | Unknown     | D'deridex-class Warbird | Romulan Star Empire (Tal Shiar)            | The Belak was part of the joint Tal Shiar/Obsidian Order fleet that attacked the first Founders' (Dominion) homeworld in 2371 during the Battle of the Omarion Nebula.                                                                                                                                                                                                                                                                | Disruptor Arrays, Phaser Array, Photon Torpedoes                          | Shields, Cloaking Device                 | ![Belak](https://share.zytronium.dev/images/warbird.jpg)                                                                                    |
| Terix             | I.R.C. 1969 | D'deridex-class Warbird | Romulan Star Empire (Military)             | The Terix discovered a hull fragment from the experimental USS Pegasus in the Devolin system in 2370. The warbird was subsequently ordered to find the rest of the ship. When the USS Enterprise-D arrived with the same mission and discovered the Pegasus, the Terix 'accidentally' sealed them inside the hollow asteroid containing the Pegasus. The Enterprise escaped using the Pegasus's experimental phasing cloaking device. | Disruptor Arrays, Phaser Array, Photon Torpedoes                          | Shields, Cloaking Device                 | ![Terix](https://share.zytronium.dev/images/warbird.jpg)                                                                                    |
| Prakesh           | CUW-8481    | Galor                   | Cardassian Union (Military)                | From 2369 to 2372, this ship was commanded by Gul Dukat of the Second Order, following the loss of his post aboard Terok Nor and as Prefect of Bajor.                                                                                                                                                                                                                                                                                 | Phaser Array, Large Disruptor                                             | Shields                                  | ![Prakesh](https://share.zytronium.dev/images/Prakesh.webp)                                                                                 |
| Koranak           | Unknown     | Keldon                  | Cardassian Union (Obsidian Order)          | This ship was illegally constructed by the Obsidian Order at Orias III and was modified with an increased top speed and the addition of a cloaking device from the Romulans. This ship would fight in the joint Tal Shiar-Obsidian Order assault on the Founders' homeworld in 2371.                                                                                                                                                  | Phaser Array                                                              | Shields, Cloaking Device                 | ![Koranak](https://share.zytronium.dev/images/Koranak.webp)                                                                                 |
| Jem'Hadar fighter | Various     | Attack fighter          | Dominion                                   | A Jem'Hadar fighter, or Jem'Hadar attack ship, was a small type of warship that formed the bulk of the Dominion fleet. These versatile starships were also known to perform the roles of patrol ships and scout ships.                                                                                                                                                                                                                | Phased Polaron Beams, Torpedoes (standard), Disruptors, Energy Dissipater | Shields, Cloaking Device                 | ![Jem'Hadar Fighter](https://share.zytronium.dev/images/Jem'Hadar.webp)                                                                     |
