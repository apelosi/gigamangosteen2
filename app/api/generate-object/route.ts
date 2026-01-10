import { NextResponse } from "next/server"

export const runtime = "edge"

interface ObjectResult {
  imageBase64: string
  description: string
  memory: string
}

const OBJECTS = [
  "rolling pin",
  "whisk",
  "spatula",
  "cutting board",
  "mixing bowl",
  "coffee mug",
  "tea kettle",
  "colander",
  "measuring cup",
  "kitchen timer",
  "salt shaker",
  "pepper grinder",
  "wooden spoon",
  "ladle",
  "cheese grater",
  "can opener",
  "corkscrew",
  "oven mitt",
  "dish towel",
  "cookie jar",
]

function getRandomObject(): string {
  return OBJECTS[Math.floor(Math.random() * OBJECTS.length)]
}

export async function POST() {
  const apiKey = process.env.GEMINI_API_KEY

  if (!apiKey) {
    return NextResponse.json({ error: "GEMINI_API_KEY is not configured" }, { status: 500 })
  }

  const object = getRandomObject()

  try {
    // Generate description and memory using Gemini text model
    const textResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `You are describing a SPECIFIC, UNIQUE ${object} - not a generic one. Imagine you are holding THIS PARTICULAR item in your hands and describing every detail you see.

Generate a JSON object with EXACTLY three fields:

1. "description": REQUIRED LENGTH: 150-250 words minimum. This is NOT a generic product description. You are describing ONE SPECIFIC ${object} with all its imperfections, wear, and character. You MUST include ALL of the following:
   - EXACT colors with nuance (not "blue" but "faded robin's egg blue with hints of seafoam green where the finish has worn thin")
   - SPECIFIC material and texture details (worn smooth maple wood with visible grain, brushed stainless steel with fingerprint smudges near the handle)
   - PRECISE measurements and proportions (approximately 12 inches long, barrel diameter of 2 inches)
   - AT LEAST 3 unique imperfections: scratches, dents, chips, stains, wear patterns, fading, patina, discoloration
   - AT LEAST 2 distinguishing features: a slightly bent handle, a repaired crack, initials carved in, price sticker residue, a manufacturing defect
   - Signs of age and specific use patterns that tell a story

   The description MUST be detailed enough that if someone saw 3 similar ${object}s, they could IMMEDIATELY identify this exact one from your description.

2. "memory": 3-4 sentences. A deeply personal, nostalgic memory from a fictional person. Include: when/how they got it, a specific moment or sensory detail, why it's emotionally meaningful, and bittersweet feelings it evokes. Make it feel authentic and moving.

3. "imagePrompt": A detailed prompt for Imagen 3 to generate a photorealistic photograph. Include: "Photorealistic, high-resolution photograph" style, specific lighting (soft window light, warm lighting), ALL the unique wear marks and details from your description, natural setting, camera angle, shallow depth of field, 8K quality.

EXAMPLE (follow this level of detail):
{
  "description": "This well-loved wooden rolling pin measures approximately 18 inches long with a 2.5-inch diameter barrel. The maple wood has aged to a warm honey-amber color with darker caramel streaks where decades of oil and flour have soaked in. The left handle has a noticeable wobble where the dowel has loosened over time, and there's a small chip missing from the edge of the right handle, exposing lighter raw wood underneath. A deep scratch runs diagonally across the barrel - about 3 inches long - where it once rolled over a forgotten twist-tie. The surface is worn glass-smooth in the center where hands have gripped it countless times, but the ends still show faint lathe marks. There's a faint circular water stain near the right end, and the wood has darkened to almost burnt umber in the creases where the handles meet the barrel. A barely visible 'M.K.' is carved into the bottom of one handle in shaky cursive, the letters filled with decades of accumulated flour residue.",
  "memory": "My grandmother pressed this rolling pin into my hands the day I got engaged, her arthritic fingers trembling as she wrapped mine around it. She'd used it every Sunday for 60 years making pierogi for my grandfather, and now it carries the weight of recipes never written down and a marriage that lasted until his last breath. Sometimes I swear I can still smell her kitchen - butter and onions and something floral from her hand lotion - when I use it. I both treasure it and dread the day it finally breaks.",
  "imagePrompt": "Photorealistic photograph of a vintage maple wood rolling pin, honey-amber colored with dark caramel streaks from age and use. Shows a small chip on right handle exposing lighter raw wood, 3-inch diagonal scratch across barrel, worn glass-smooth center with visible lathe marks on ends, faint circular water stain, darkened wood in handle creases. Soft warm kitchen window light casting gentle shadows, shallow depth of field, resting on a flour-dusted butcher block counter, 8K quality, natural textures, photojournalistic style"
}

CRITICAL: Your description MUST be at least 150 words with specific details. Generic descriptions are NOT acceptable.

Return ONLY the JSON object, no markdown, no explanation.`,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.8,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 1500,
          },
        }),
      },
    )

    if (!textResponse.ok) {
      const errorText = await textResponse.text()
      console.error("Text generation failed:", errorText)
      throw new Error(`Text generation failed: ${textResponse.statusText}`)
    }

    const textData = await textResponse.json()
    const generatedText = textData.candidates?.[0]?.content?.parts?.[0]?.text || ""

    // Parse the JSON response
    const jsonMatch = generatedText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error("Failed to parse JSON from Gemini response")
    }

    const parsed = JSON.parse(jsonMatch[0])

    // Generate image using Gemini's native image generation
    const imagePrompt =
      parsed.imagePrompt ||
      `Photorealistic photograph of a ${object}, natural lighting, high resolution, realistic textures, shallow depth of field`

    const imageResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp-image-generation:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: imagePrompt }],
            },
          ],
          generationConfig: {
            responseModalities: ["IMAGE"],
          },
        }),
      },
    )

    let imageBase64 = ""
    if (imageResponse.ok) {
      const imageData = await imageResponse.json()
      console.log("Image API response structure:", JSON.stringify(imageData, null, 2).substring(0, 2000))

      // Gemini image generation returns data in candidates[0].content.parts[0].inlineData.data
      const parts = imageData.candidates?.[0]?.content?.parts || []
      for (const part of parts) {
        if (part.inlineData?.data) {
          imageBase64 = part.inlineData.data
          break
        }
      }

      if (!imageBase64) {
        console.error("No image data found in response")
      }
    } else {
      const errorText = await imageResponse.text()
      console.error("Image generation failed:", imageResponse.status, errorText)
    }

    const result: ObjectResult = {
      imageBase64,
      description: parsed.description || `A ${object}`,
      memory: parsed.memory || `This ${object} holds special memories from years past.`,
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error("Error generating object:", error)
    return NextResponse.json(
      {
        error: "Failed to generate object",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
