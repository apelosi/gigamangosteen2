import { NextResponse } from "next/server"

export const runtime = "edge"

interface KitchenObjectResult {
  imageBase64: string
  description: string
  memory: string
}

const KITCHEN_OBJECTS = [
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

function getRandomKitchenObject(): string {
  return KITCHEN_OBJECTS[Math.floor(Math.random() * KITCHEN_OBJECTS.length)]
}

export async function POST() {
  const apiKey = process.env.GEMINI_API_KEY

  if (!apiKey) {
    return NextResponse.json({ error: "GEMINI_API_KEY is not configured" }, { status: 500 })
  }

  const kitchenObject = getRandomKitchenObject()

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
                  text: `Generate a JSON object with three fields for a ${kitchenObject}:
1. "description": A brief 1-sentence description of this kitchen object (what it looks like, its typical use)
2. "memory": A personal, nostalgic memory from a fake person about this specific ${kitchenObject}. The memory should be 2-3 sentences, emotionally evocative, and include specific details like when they got it, why it's meaningful, and mixed emotions it brings up. Make it feel real and heartfelt.
3. "imagePrompt": A detailed prompt for generating a 256x256 cartoonish image of this ${kitchenObject}. Include style details like "cute, whimsical, bright colors, clean lines, simple background"

Example format:
{
  "description": "A wooden rolling pin with smooth handles and a cylinder body, used for flattening dough.",
  "memory": "I bought this rolling pin about 5 years ago during COVID when I was stuck at home and baking a lot of bread. It brings back both good memories of making sourdough and perfecting my cinnamon rolls, but also sad memories of how much COVID prevented me from seeing my friends and family during those long, isolated months.",
  "imagePrompt": "A cute cartoonish wooden rolling pin with smooth brown handles, sitting on a pastel blue kitchen counter. Bright, cheerful colors, simple clean lines, whimsical illustration style, flat design, 256x256 pixels"
}

Return ONLY the JSON object, no other text.`,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.9,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 400,
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

    // Generate image using Imagen 3
    const imagePrompt =
      parsed.imagePrompt || `A cartoonish ${kitchenObject} illustration, cute style, bright colors, 256x256`
    const imageResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          instances: [{ prompt: imagePrompt }],
          parameters: {
            sampleCount: 1,
          },
        }),
      },
    )

    let imageBase64 = ""
    if (imageResponse.ok) {
      const imageData = await imageResponse.json()
      console.log("Image API response structure:", JSON.stringify(imageData, null, 2).substring(0, 1000))
      // The predict endpoint returns predictions array with bytesBase64Encoded
      imageBase64 =
        imageData.predictions?.[0]?.bytesBase64Encoded ||
        imageData.predictions?.[0]?.image?.bytesBase64Encoded ||
        imageData.generatedImages?.[0]?.image?.imageBytes ||
        imageData.images?.[0]?.bytesBase64Encoded ||
        ""
    } else {
      const errorText = await imageResponse.text()
      console.error("Image generation failed:", imageResponse.status, errorText)
    }

    const result: KitchenObjectResult = {
      imageBase64,
      description: parsed.description || `A ${kitchenObject} commonly found in kitchens`,
      memory: parsed.memory || `This ${kitchenObject} holds special memories from years past.`,
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error("Error generating kitchen object:", error)
    return NextResponse.json(
      {
        error: "Failed to generate kitchen object",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}
