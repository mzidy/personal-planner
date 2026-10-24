# Alexa ("Serene planner" skill)

A custom Alexa skill in development mode: never published, free, and
available on every Echo signed in to the same Amazon account as the
developer console. Alexa sends what you say to
`https://personal-planner-sandy.vercel.app/api/alexa`; the app checks Amazon's
signature, runs the same commands as Voice control, and answers.

English only: Alexa has no Slovenian.

## Setting it up

1. https://developer.amazon.com/alexa/console/ask, signed in with the Amazon
   account your Echo uses. (On the developer home page this is **Alexa Skills
   Kit**, not the Alexa+ console. Identity verification can wait; it is for the
   Appstore.)
2. **Create Skill**: name `Serene planner`; the language your Echo speaks
   (e.g. English (US) or English (UK)); type **Custom**; hosting **Provision
   your own**; template **Start from scratch**.
3. **Interaction Model → JSON Editor**: paste `interaction-model.json` from this
   folder, **Save**, **Build skill**. (It sets the invocation name to
   `agent smith`; the console requires at least two words.)
4. **Endpoint**: HTTPS, default region
   `https://personal-planner-sandy.vercel.app/api/alexa`, certificate option
   *"My development endpoint is a sub-domain of a domain that has a wildcard
   certificate from a certificate authority"*. Save.
5. Copy the **Skill ID** (`amzn1.ask.skill.…`) into Vercel as
   `NUXT_ALEXA_SKILL_ID` (production) and redeploy. Until then the skill only
   answers that it is not set up.
6. **Test** tab: enable testing in **Development**.
7. In Serene, **Voice control → Link Alexa**, then say the code:
   "Alexa, ask agent smith to link 482 913". The page shows when it worked.

## What it understands

- "Alexa, ask agent smith to add oat milk to my shopping list"
- "… add a task call the plumber high priority"
- "… take a note the boiler service is due"
- "… my weight is eighty four point two"
- "… add a diary entry today went well"
- "… add reading to my daily routine"
- "… what is on today"
- "… start the vacuum" / "pause the vacuum" / "send the vacuum home" /
  "find the vacuum" / "where is the vacuum" (the first vacuum connected under
  Smart Home)

Like Voice control, the planner commands only add; nothing is changed or deleted.
The vacuum commands are the same fixed set as the Smart Home page's buttons.

After the interaction model changes, paste it into the JSON Editor again and
**Build skill**.
