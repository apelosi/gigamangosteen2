// Gemini API integration for generating kitchen object images and memories

export interface KitchenObjectResult {
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

export async function generateKitchenObjectWithMemory(): Promise<KitchenObjectResult> {
  const apiKey = process.env.GEMINI_API_KEY

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set in environment variables")
  }

  const kitchenObject = getRandomKitchenObject()

  try {
    // Step 1: Generate the image using Imagen 3
    const imageResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-001:predict?key=${apiKey}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          instances: [
            {
              prompt: `A cartoonish, friendly illustration of a ${kitchenObject} in a simple kitchen setting. Bright colors, clean lines, cute and whimsical style. 256x256 pixels.`,
            },
          ],
          parameters: {
            sampleCount: 1,
          },
        }),
      },
    )

    if (!imageResponse.ok) {
      throw new Error(`Image generation failed: ${imageResponse.statusText}`)
    }

    const imageData = await imageResponse.json()
    const imageBase64 = imageData.predictions?.[0]?.bytesBase64Encoded || ""

    // Step 2: Generate description and memory using Gemini text model
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
                  text: `Generate a JSON object with two fields for a ${kitchenObject}:
1. "description": A brief 1-sentence description of this kitchen object (what it looks like, its typical use)
2. "memory": A personal, nostalgic memory from a fake person about this specific ${kitchenObject}. The memory should be 2-3 sentences, emotionally evocative, and include specific details like when they got it, why it's meaningful, and mixed emotions it brings up. Make it feel real and heartfelt.

Example format:
{
  "description": "A wooden rolling pin with smooth handles and a cylinder body, used for flattening dough.",
  "memory": "I bought this rolling pin about 5 years ago during COVID when I was stuck at home and baking a lot of bread. It brings back both good memories of making sourdough and perfecting my cinnamon rolls, but also sad memories of how much COVID prevented me from seeing my friends and family during those long, isolated months."
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
            maxOutputTokens: 300,
          },
        }),
      },
    )

    if (!textResponse.ok) {
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

    return {
      imageBase64: imageBase64 || "",
      description: parsed.description || `A ${kitchenObject}`,
      memory: parsed.memory || `A meaningful memory about this ${kitchenObject}.`,
    }
  } catch (error) {
    console.error("Error generating kitchen object:", error)
    // Return fallback data if API fails
    return {
      imageBase64: "",
      description: `A ${kitchenObject} commonly found in kitchens`,
      memory: `This ${kitchenObject} holds special memories from years past.`,
    }
  }
}
