[![Scenario Knowledge Base](https://avatars.usepylon.com/2510f347-0eaa-468f-8bdb-0d085320e766/org-avatars/ee07eb83-bfe5-4ece-a7f0-76f515a77531-1775742383314)![Scenario Knowledge Base](https://avatars.usepylon.com/2510f347-0eaa-468f-8bdb-0d085320e766/org-avatars/ee07eb83-bfe5-4ece-a7f0-76f515a77531-1775742383314)](https://help.scenario.com/)

Login

[All Collections](https://help.scenario.com/)› [Video Guides](https://help.scenario.com/collections/4108299631-video_guides)

# Create Spritesheets with Scenario

Last updated 3 months ago

## **How to Create Spritesheets for Character Animation**

Spritesheets are vital for 2D game animation, powering sequences like walking, attacking, and idle loops. This guide walks you through how to generate consistent, frame-by-frame sprites using Scenario’s models like Nano Banana, Seedance, or Pixverse.

With just a few steps, you can go from a static character design to a fully animated spritesheet - ready for implementation in your app, game engine or toolset.

![](https://assets.usepylon.com/2510f347-0eaa-468f-8bdb-0d085320e766%2F4371315f-59a0-4438-a7c1-e27608655fc8-8c6be37c8aff0eb81f58c43599542195.gif-c7265877-d86e-461b-ae49-353c493b2229?Expires=253370764800&Signature=WexEuXqTeK~6QOIrndYSe0tB7KMKYq0Nxt-FmLyP~nPC4lD62ybN5QJFMwH18wE4X15JM9xQ90Afr3~lcYhfo9KJQS2pntCDneM9FkfnuVFHZLmSvKfOI9gHulkUqC5Lf6qqNVoiyeROzWYBvJBzDANzqY4fE5YkxO8Pkl00NmYmYTftpamNCfzo~SFNkLn-2aJcV8avveX3~GTKrGcxUQ-3d4Hu5s83Ii2X3NnapJSyY6DrXaYpJNxaSnU0uiXIcb9OYtGr1s48hkByliiH8idKVkchu-scIc2EoT8ZIgy0gz1q-itVIK6NJ~cYOhYNWRd2ciUBr8J2gbXd08uzQQ__&Key-Pair-Id=K3NV4LZ47N8M46)

* * *

## **Step 1: Generate the Base Character Image**

Begin with a side-view image of your character in a running pose - this will act as the first frame and foundation for your spritesheet. In this guide, we're using a running animation as an example, but the same process applies for any loop, such as idle, walking, or attacking.

You can create this image directly in Scenario using a base model like Flux or Imagen, or a custom-trained style or character model for consistent aesthetics, ensuring higher fidelity frames. Alternatively, simply upload an existing image to your Scenario workspace to begin.

The example below was generated using the [Childs Play](https://app.scenario.com/models/model_BfwJ9R227sxRFJMnGbKdp9Np) model. You'll find the associated prompt, settings, and parameters included for reference.

![](https://assets.usepylon.com/2510f347-0eaa-468f-8bdb-0d085320e766%2F74ddb8b8-e241-4461-b4f7-4f326152c690-53cf4d7b4251a89f1a7bac5ba7a2155a.png-1b99e6c9-f5e5-4830-8a7e-7470de5bb919?Expires=253370764800&Signature=L6ou8kdL0N2DZjx3rE2-UQnkGnG7tQcOELQmwGcsvsyTKdd0itlXoqa3hBTW~md2x4U9zqSsmk1g1XhMEK1T6DKfLRZT-debyx4CzLhy5g4JihzYtRebUF4C0Boylw1a1mLPw3WGNx1LCeWEreL8ScN91zdfm7O5H2h7fUAq5XBr1qG2h9RAqMArzN7vTKKbTNq2qGpfHjnZtbC0btjvZdVyKjutlh-s64ppz9EEI~JwgzuogCK6l6pGi6LrgnIrgvUc0A2yIAUSmaSGyMPtQcA7taPxh8SHrIRiVevrEOnYsunrWjlCZD3lAjJKPH-sW7TIV77cjZct99V4dSj9bQ__&Key-Pair-Id=K3NV4LZ47N8M46)

Once you're happy with your base image, open the three-dot menu in the top-right corner and select “Convert to Video.” This will launch the video generation interface, with your image automatically loaded as the first frame (to the left), ready to guide the video sequence.

![](https://assets.usepylon.com/2510f347-0eaa-468f-8bdb-0d085320e766%2Ff3e875ec-9df5-4c86-a385-3f69210c88a9-c18c0cb7d9686bae188c5317f760ec2f.png-cce8d72c-eed1-43d8-919c-f5611895bbc0?Expires=253370764800&Signature=XBAxyusuoBppf6B1m6FQ5A4IgfFEr57q6zhxR1-QaV-b2DBJg5K4Ivej-eN1j9CcSR~k0QvI~6YkSikEBtcZ5DEgjCW0zc8kiCUiFGtEm43ukJAd~Y6V68vQ5~l78EgmigxqUdjy7eA3yKu432X6V53mKEBErmxeg-KDlcfd2WplOAtxrqWh6mq3Hrtm-27nsQKFhGGMo14Z54Kpser8~GUkxt3CUOjZ3T6NI9aBhxsqCAjVAu7YYdxf5SMj4HDAVkAbu8bf35vSeXQ7OVwnoKr01p6DcCP7pND89OYl2NAtgp0-0EtgHI7zdmB04-o3MgD~GrA25PnNP4na9uM0Yg__&Key-Pair-Id=K3NV4LZ47N8M46)

* * *

## **Step 2: Set Up Video Generation**

On the video generation page, begin by selecting a video model. Click the **model dropdown** in the top-left corner and choose either **Seedance 1 Lite** or **Seedance 1 Pro** \- both support using a reference image as the **first frame** to guide the animation. **Seedance 1 Lite** also supports last frame.

These models are optimized for smooth, stylized motion and are well-suited for sprite animation workflows.

![](https://assets.usepylon.com/2510f347-0eaa-468f-8bdb-0d085320e766%2Fcacb111a-a2d8-4604-b65e-8e17ed5a4880-2610837d70915f2ed21e42814e4903b8.png-63b32795-f987-4cc3-8397-30386a5f7246?Expires=253370764800&Signature=p5Zh7MBEUVgzaiEHxcdFPoj5IWbcAJfd6CQ2vRJw21PCfqvYbB~d4iyNcIVGk80Rr4MLuyO5iDD7dp0~ZZaTFD5eigFJzmJpnCVSgB~EHyFgkQDUDm86huh49FFUyBbsfKp-tbmo3Cj2ctUcGNXkvQlrGXh0D4DQyy963wJbjgGS-urm8RBP0JpqyGMAHRnPIdAurPcezFBtkLs0ztAeAKdR1ROcP0oHojCuJEDbJ-bmibf~yeq5gGvRaGDRsdmY4BJDzHULLrfn2iGNeMR3RhUtGdbRf9665eW92epDXBQDFh-1~CFLEJuphdR~sgVgv1DgqGl8YUXTR6pgfy8owg__&Key-Pair-Id=K3NV4LZ47N8M46)

Next, enter a simple prompt describing the action you want to animate — for example, “a boy running.” Then click “Rewrite your Prompt” below the prompt box to enhance it for the selected AI model.

Review the rewritten version and make any adjustments to better match your character or desired motion.

![](https://assets.usepylon.com/2510f347-0eaa-468f-8bdb-0d085320e766%2Fb1e59119-1ece-43d4-9800-100016564995-7fc2e4a2fe7fa25d1da4d76018f8aa13.png-729c6bf0-95d0-461c-bd26-ce4750559878?Expires=253370764800&Signature=ve9-V2146xFucH7hD4f8I3f8TMVTUf~D2Ez9ynCP5c-wlgLRio0YWFU619tlDTbGglhvXxe2rLNPT5hAx~YD4kHHYLyL3OQmDIlyAAhJiV5xWEDEAKrYs7-IDkhf1S2rnqE1msQIbr8E-yLquSOTlZIia1MIgPh4BfZ20K4alJ~FvX3NEh8U-zboHg5dmzQlLJ2Rzj1gqwbEivE0mXqOdxCI55mZWuLapEPKvmNq-XZf9XjmWEim6srzixLf-QJ2dx3IJrbfTUZ6tVGAVn--KhjJey~2zbqp~Lu7P-sU-3SsqRPC7ndx2ahhDSh-VodEYLxJ8ZaV9LT78xhZ57Lq3A__&Key-Pair-Id=K3NV4LZ47N8M46)

These were the parameters used to generate the video: **Duration**: 5 seconds / **Resolution**: 1080p / **Aspect Ratio**: 1:1 / Camera Fixed: Off

Click Generate and wait for the video to render. Once complete, preview the animation and identify the key poses in the sequence (for example, contact, lift-off, or mid-stride in a running loop.)

The motion may sometimes be slow or slightly imperfect. Focus on spotting frames that clearly represent the essential stages of the animation.

* * *

## **Step 3: Extract Key Poses**

Refer to the image below for an example of a typical 8-frame run cycle, highlighting key poses you may want to capture for your spritesheet.

![](https://assets.usepylon.com/2510f347-0eaa-468f-8bdb-0d085320e766%2F7f00d496-9bc6-4d86-9c6e-25e1ac159188-4e41df6a5de979ad3844991fa77e451e.png-0a546c80-7f2e-47b0-a7ce-cefdc7a8ba00?Expires=253370764800&Signature=MgRdvhNiqsqaqqZmrLgHG9J2eTpQjvdrbmavErG4C1tS1GFhgQTdFjL8AEjJEh6dlbwhuweL3~mBNqOezSVX9hOFdJwLkbfLLWSGa31BFSzrctUu~zU~KD8DafbAjnzpAhFh6S7t7lrFNr~6AWk9bEdfHpH5Qd8ykHsbwRkeAT3kw4GN2Ivdu12aDRjMIUz0pVS42rTJgzr~b8YEYHG~5lE0eDDn-mikqbn-XJoKufsIAN9R2XVm52PTGl1UZQqjLmM9hQGU9Ka2wyN7RLxZSJGO4-8Yr7x4LtT8meRRXVaLyZBjgNrxN5~4Z333ip6Rp1LxrpC2YQeSFcxiSpqt0A__&Key-Pair-Id=K3NV4LZ47N8M46)

Capture each key pose by taking screenshots of the selected frames, or use a video editor to extract them directly. Save each pose as a separate image, ideally in the same format and resolution to ensure consistency across your spritesheet.

![](https://assets.usepylon.com/2510f347-0eaa-468f-8bdb-0d085320e766%2F84fe6a5c-864f-45d2-bb6e-3dd5ced735db-bae87450848f0fe595a3371c8c819d8d.png-f0ee3780-e925-4f9b-8658-e63a28600939?Expires=253370764800&Signature=DZPwbOHgCMt4W3VJFt2N86e6vdfUILi6m0gatPJWCUIJe0Mk1WgOPiNeEYGhx7ZEhiADEA86I31gaoLu~SfRsMvNOkJ9Owf-lNcGPYIDxXFLjqnOiSNxWzNfiGHKPXIxuE2xeWL5UbQuPMO007KHK8q0QFns0pkrXM4WMqV8mU6lUH-UvwBAtngIqizKpUVnO0UGDcEK1ZZYNsusmGHH5A~IEbauXT14mY1Nsl6csH4fEa-8pwZL1kPTymP4~SQEjRG88Pn8U-bxCmLCjE0Xs4JLBcso0FQg-Xu-uEnI9Vasd7CMk~4t2GqjkauuAxfhUBR96DoNftvQfMezMvGgKQ__&Key-Pair-Id=K3NV4LZ47N8M46)

* * *

## **Step 4: Create the Spritesheet**

Use an image editor or an online tool like [Final Parsec Sprite Sheet Maker](https://www.finalparsec.com/tools/sprite_sheet_maker) to arrange your extracted frames into a single spritesheet. Make sure the poses are evenly spaced and aligned for smooth playback when animated.

![](https://assets.usepylon.com/2510f347-0eaa-468f-8bdb-0d085320e766%2Fb38d05c8-32dc-46f7-84c3-c39865776f90-00880180b2dedd25a03812708b2044c3.png-a0fa22dc-5631-41c1-a8d9-eec8ccfb1f39?Expires=253370764800&Signature=DMKui2isiweD10pz-xzM-FFLuOuRw3gSBe74wbjRQAxeKwGIwMEOV0bF3WYYNwhyKLpSsyDOAoNP5-MWV3DG3nUznaON~yN4zJdTveua6bULFo~0ddl0ZejtJicOdZflagT3ZcUahocC44RuCtwNGi5FISd5c73nF4DpWJl23f6~kGhL1QPdZXvFfq4tTJqt~gW5b6qmwlfqp2zaGKVdwwYC4Ea0pYA4uEfCZAkS-VNoaJsp~4fI9Nom8HNK3FY823xrOZPwbok8xgtcTP-ffVDO9OavrEXxt4OOV3h3uUUVyV6EgkkVQBSxejyMEWDALeYX9FKvslM~uVSaSJLDcA__&Key-Pair-Id=K3NV4LZ47N8M46)

Once done, test your spritesheet in Unity, Unreal Engine, or with online preview tools like [is.si](http://is.si/) [Animator](https://is.si/animator/) to ensure the animation loops correctly.

You now have a fully functional run-cycle spritesheet.

![](https://assets.usepylon.com/2510f347-0eaa-468f-8bdb-0d085320e766%2Fa7e1ceff-5336-4ab2-b100-676a698c3f38-eb28523b67f20e30494925d9c66905c4.gif-e98f0827-d346-4257-9f93-7cd77a173d7e?Expires=253370764800&Signature=AGKh3tjhvnkYFAiJZN8TmA0A8BTYQtdpmQO3KLEj~JCUXFTLq1wrTCmk2Rj2rQnGwmp4ymzX6tO0dhpquojM3NTRMZkmgSO~4WK8TlO1Yjw2-s2QgzgBVAmsYJI1vgHKl-WpnOt1TSVOM5avPR3rzB9xmRq6cKFySeNRgbi-Ec78T45baZnP3zv3Rvkkz6Rkn~IBW~qGS7JUbGVWEHT8DTQHyiuyyJuuw6alQJvS5XzCUZXbGODztbziISDLz1psFMmgPHNuYncC5OW7UZcFHn-27YeVphBrfM0LVwVuc6HPZ~ey~8dSWNc0fVM65lQRCYKVpJsxxlHRvU~OfNUpng__&Key-Pair-Id=K3NV4LZ47N8M46)

* * *

## **Advanced Example: Attack Animation**

For more dynamic sequences, you can also try other models like **Pixverse v4.5**, which supports **first and last frame inputs** to create guided, sequential motion.

To start, generate a video that transitions from a **neutral pose** to an **attack pose**. This will serve as the first half of your animation sequence.

![](https://assets.usepylon.com/2510f347-0eaa-468f-8bdb-0d085320e766%2F2dc9719e-4314-4284-b839-76239b51631a-2cd41083bb9b19985f0874967d30a406.png-fd335d97-ec98-49e7-9d83-85d5849b69e0?Expires=253370764800&Signature=YAP2~sNhPB425hlYwi9~J5m-WqflyHtKbWXSqyUNclIpr89bzhaWtxE61s6bx3jsq9Wkgx73GZczvJhq7b-HemtEyXX3auXWPpc9XskUd05eETK7AaqpGtD~H1u8rAW0YfaimSZ4eoHPD2C6uyZi9X9sp7tC2GqzPHiTA2ZHYKuj88c98uK7-Qaq8xB8li25Ff3hJ6MS~5wlrCs3t6k-zHPWwy1Z2cWhI3UU0OfO4qcB7nRUgzMaLWWd4~LsnIFxicMW76dVe3n2jb3RKugNXsAOgFJBjHv~ET0eXaR92evlvUtgePuvrOmuWQniI-K0Ep83dUubhKFnQZ2tN8q4iA__&Key-Pair-Id=K3NV4LZ47N8M46)

Next, generate a second video that brings the character from the attack pose back to the neutral pose.

To do this, simply swap the first and last frames from the previous video. This creates a smooth return motion, completing the full attack loop.

![](https://assets.usepylon.com/2510f347-0eaa-468f-8bdb-0d085320e766%2Fad455987-2f44-4158-bd2c-0cc45dcac043-bef084413a6acda803fa8df2a1d0a169.png-4e7c1dd9-745a-48c8-ac90-d6843f499623?Expires=253370764800&Signature=rE2B4rPYRIV2uQO4~YwB41HZp5soeZmd4XF-ea2EXgj2OTcq~ko1JvNqrhPHwKuxTXC6F34Fk09OM7ipZXnGvODCX~QZNOQtILws7mGIn~fMZUZpP-4f-ofCZ~OmSB-Ckp-ypKVa5hRHy6UhpwhokEEQjPRizUPjCDSQHlKLs2UU~jb-ZjR4ghxWW1QIHrGz5yaBpGTmsvO1OCE78UDhtYNWbDwxfsK~4A-Nr6PloXkAO95lmt8qx5pmRY~FZrKkC4DxGxGHa0BEL74xTloum~36HtYnBzwUJ1UJ~YmCG6ck072L88A~~BNTR1E0WcsYix8-5vgr~QSHyy8n4hN5Mw__&Key-Pair-Id=K3NV4LZ47N8M46)

In this example, Pixverse v4.5 was used to generate the videos. These were the parameters used to generate both videos: **Quality**: 720p / **Aspect Ratio**: 1:1 / **Duration**: 5 seconds / **Motion Mode**: Smooth. You may try other settings too.

To make the animation sequence clearer, the two videos were combined into a single edit, showing the full motion from neutral to attack and back.

From the combined video, **16 key poses** were extracted to build the final spritesheet shown below.

![](https://assets.usepylon.com/2510f347-0eaa-468f-8bdb-0d085320e766%2F688a1847-aab5-40f5-8139-7a4f887b08f8-4dd37f9f9fa6d1da583fbca3365801c8.png-f5872ed8-cb45-4fe3-80ff-4c76796519c2?Expires=253370764800&Signature=kbeY0jJvrPL9fepDE6gO4qx22PTLX37yClPNjmVKtK78RYvEAF6IB75~DZMu3~F9cn0DyYM9ysVdoDi3Lp9iVNBQZJG3ifP6LOVe49RuBmv55meyFkOAWqFLlkCzolItab8RgD4nA5xFwuYvFnJmZ0pSaBDmnw~vGjhULQ56qTR5k76tdmSx3J61f5V8LrRLgN3WVSY10WizT8sIQ0vsq0VFwJQt39kUdJhm8QuiQHtegzAK4CqP~x-DKYIgDectebkhYyMtDVpAiQxz66p5-GVlnBa54X8unPDhg~MakZh7VoR8afl~N-qECGz1PPFRsn0B-LxthOn8L9or5XXGwQ__&Key-Pair-Id=K3NV4LZ47N8M46)

From the completed spritesheet, the following animated GIF was created to preview the full attack loop in motion.

![](https://assets.usepylon.com/2510f347-0eaa-468f-8bdb-0d085320e766%2F1a5a7173-7960-4cbf-9552-c96b674dac3d-11421fbd46295544701dd9b1a345c0ce.gif-3245cd0f-92f4-4033-ba0d-86cae0c5bbc2?Expires=253370764800&Signature=Oj1bJAr9bhn2Uht988X0gTxsCqg8pbGCa31m1LwTX3JS1Diopmc63VwETg5JcXSz8L~Hp9smVkHbmku3Z6ZwdXaDZcsu9EOECYyEa5M8M25tiI4DuxDGk1Nmwn0fThGOYXSitL6U-dzLcijoSysI9ZZeQrgbKiwfnh~kP0ANMW5IOjZ2E~R5qKp22ffne-NWscn7FusEX-LTcT5W05QoN-8megHPwYQZwO5d46YKY8SxVd7WoZ29BL60WsQJAHDfvlJGfY19A2wdUQBIUhLDzGR7iZOTCdnI03rfoCeD-K~I~Gvpe5fhsjYd9uRz6ImCwut1WN8k8kUvEmsPboyMSQ__&Key-Pair-Id=K3NV4LZ47N8M46)

* * *

## **Example: Chest Animation**

This same workflow can also be used to animate props or environmental objects, like doors or treasure chests.

To start, generate or upload an image of a treasure chest, then simply open the three-dot menu in the top-right corner and select “Convert to Video” to launch the animation interface.

On the video page, select your video model, in this example we used Seedance 1 Pro, then enter the motion prompt such as “open and close loop”. You can even use Prompt Spark to re-write your prompt.

![](https://assets.usepylon.com/2510f347-0eaa-468f-8bdb-0d085320e766%2F56c5a73e-5392-4ef2-ae7f-6e79d8526067-e0d3e9a57ca03ebbbdd65693bc22937d.png-563369ef-ee09-442c-90f8-b153e8af90fa?Expires=253370764800&Signature=DJD2XL8s1JT-i7e10U1gf5bH4Bet5CTlPpPKIDg1VBUqAHYg-A6KAizCgl1s~fXVgtEZB2aXoS6JRKXCHxUUCWxOe7eGLsifjU3s5YYik4ryYqZrzUx-eGnCXHgc2Xj3a-9rE2YYm~rD7AtaoDnkxYKC36ICWoL8nRfB7nspqWmNNoPhpS8FrMwC6EkjaqM11U1eIaM3Yxt5eZdXda5zHZuniOWbYSBswZnfJGVclTFLmxfc5~eUi1HLstvnFAGGSglOWIFgvjOT-Le-5HayUieN~ItwyjCR653UXb8nLWD54UBOd7Pop2tHLHHeHAeRns26Rl8lT3F0~J5NAM2nQA__&Key-Pair-Id=K3NV4LZ47N8M46)

From the video, you can extract every frame to build your final spritesheet, covering both the open and close phases of the animation.

From the completed spritesheet, you can also create an animated GIF to preview the full loop in motion.

![](https://assets.usepylon.com/2510f347-0eaa-468f-8bdb-0d085320e766%2F5a2043cb-6cf7-4f02-8ac7-1581f29e225a-26201fd8a03a51b0b02001c96e927984.gif-b6c6cba9-c684-455a-aadd-2648ee6eee69?Expires=253370764800&Signature=nTt9oEaPlpa3Mbs96d0vpQnLXrPK7tUnaBxEewPxcXC3nrXC6Lnc6dYbX7gMK47ashKF8~jQaDNo2iqMTFvcNF6QY0IpiFPLF98HlA1rJ~o4bo3mP0IA48KEKf0z9rgdtQoiftznsCeo9-8eHPOkTsJvHpl99bL1Nw8qSJhrodqKHx1wCv6jB7esriUR54hrS13Y4lKlqkIexYpPxN-ZdaxMjuhpAnqBsZs4n8mvGcNLCRVQI2Pp3Y5x~xj0E4rKQ7VshBIbRBD2i8O~jHLvr8VVVsVLMJQte-OBmF1UvK87mKtcNlEjNwTMKV-7mSw63FRGV13r3Q9zyi1NFwIMng__&Key-Pair-Id=K3NV4LZ47N8M46)

* * *

## **Conclusion**

By following this workflow, you can create professional-quality spritesheets for your game characters directly within Scenario. From basic run cycles to more complex attack animations, this process helps you build consistent, stylized motion sequences with precision and control.

Try experimenting with different poses, actions, and custom models to expand your animation library and bring even more life to your characters.

How helpful was this article?

😞😕😐🙂😊

[How to Create Spritesheets for Character Animation](https://help.scenario.com/articles/9088582240-create-spritesheets-with-scenario#how-to-create-spritesheets-for-character-animation) [Step 1: Generate the Base Character Image](https://help.scenario.com/articles/9088582240-create-spritesheets-with-scenario#step-1-generate-the-base-character-image) [Step 2: Set Up Video Generation](https://help.scenario.com/articles/9088582240-create-spritesheets-with-scenario#step-2-set-up-video-generation) [Step 3: Extract Key Poses](https://help.scenario.com/articles/9088582240-create-spritesheets-with-scenario#step-3-extract-key-poses) [Step 4: Create the Spritesheet](https://help.scenario.com/articles/9088582240-create-spritesheets-with-scenario#step-4-create-the-spritesheet) [Advanced Example: Attack Animation](https://help.scenario.com/articles/9088582240-create-spritesheets-with-scenario#advanced-example-attack-animation) [Example: Chest Animation](https://help.scenario.com/articles/9088582240-create-spritesheets-with-scenario#example-chest-animation) [Conclusion](https://help.scenario.com/articles/9088582240-create-spritesheets-with-scenario#conclusion)

Related Articles

[Generate Controlled Character Animations](https://help.scenario.com/articles/4057845289-generate-controlled-character-animations) [Animate Multiple Characters on Scenario](https://help.scenario.com/articles/1719314020-animate-multiple-characters-on-scenario) [Animate an Isometric Building Transformation](https://help.scenario.com/articles/7588336368-animate-an-isometric-building-transformation) [Spatial Prompting for Videos Generation](https://help.scenario.com/articles/1360269978-spatial-prompting-for-videos-generation) [Generate Long, Cohesive Videos from Guided Frames](https://help.scenario.com/articles/7188814426-generate-long-cohesive-videos-from-guided-frames)

[![Scenario Knowledge Base](https://avatars.usepylon.com/2510f347-0eaa-468f-8bdb-0d085320e766/org-avatars/ebedca11-8844-4f64-b590-c17cb28b46a1-1785941456259)](https://help.scenario.com/)[Powered by ![](https://static.usepylon.com/logo_subtle.png)Pylon](https://usepylon.com/)