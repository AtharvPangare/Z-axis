import os
import json

# ---------- Material knowledge base for offline explanations ----------
MATERIAL_TRAITS = {
    "RCC": {
        "why": "Reinforced Concrete delivers very high compressive and tensile strength due to steel rebar embedded in concrete",
        "tradeoff": "it carries a higher material and labour cost compared to masonry alternatives",
        "best_for": "columns, slabs, and any span exceeding 5 metres",
    },
    "Steel Frame": {
        "why": "Structural steel offers an exceptional strength-to-weight ratio and performs well under both tension and lateral loads",
        "tradeoff": "cost is significantly higher than masonry, and it requires fire-proofing and anti-corrosion treatment",
        "best_for": "long-span beams, portal frames, and high-rise load paths",
    },
    "Red Brick": {
        "why": "Fired clay brick provides reliable compressive strength with well-understood construction practices",
        "tradeoff": "it is heavier than AAC or fly-ash alternatives and offers moderate thermal insulation",
        "best_for": "load-bearing walls in low-to-mid-rise construction",
    },
    "AAC Blocks": {
        "why": "Autoclaved Aerated Concrete is lightweight, thermally insulating, and very cost-effective",
        "tradeoff": "compressive strength is lower than brick or RCC, making it unsuitable for primary load paths",
        "best_for": "partition walls and infill panels where weight reduction matters",
    },
    "Fly Ash Brick": {
        "why": "Fly ash bricks utilise industrial waste, offering good strength with excellent durability and lower carbon footprint",
        "tradeoff": "availability can vary regionally, and initial curing time is longer than red brick",
        "best_for": "general walling including both partitions and light load-bearing elements",
    },
    "Hollow Concrete Block": {
        "why": "Hollow blocks are economical and allow reinforcement to be threaded through their cavities",
        "tradeoff": "the hollow core limits compressive capacity versus solid masonry",
        "best_for": "non-structural walls and boundary walls",
    },
    "Precast Concrete Panel": {
        "why": "Factory-cast panels ensure consistent quality, rapid erection on site, and Very High durability",
        "tradeoff": "transportation of large panels adds logistics cost, and joints must be carefully waterproofed",
        "best_for": "structural walls, cladding, and floor slabs in fast-track projects",
    },
}

def _offline_explanation(element, materials):
    """Generate a detailed, context-aware explanation without any API call."""
    elem_id = element.get("id", element.get("element_id", "unknown"))
    elem_type = element.get("type", "PARTITION")
    span = element.get("span_metres", 0)

    top = materials[0] if materials else None
    runner_up = materials[1] if len(materials) > 1 else None
    third = materials[2] if len(materials) > 2 else None

    if not top:
        return "No material data available for this element."

    type_label = "load-bearing wall" if elem_type == "LOAD_BEARING" else (
        "partition wall" if elem_type == "PARTITION" else elem_type.lower().replace("_", " ")
    )

    traits_top = MATERIAL_TRAITS.get(top["name"], {})
    traits_runner = MATERIAL_TRAITS.get(runner_up["name"], {}) if runner_up else {}

    # Build the explanation
    parts = []

    # Sentence 1: Element context
    if span and span > 0:
        parts.append(
            f"Element {elem_id} is classified as a {type_label} spanning {span:.1f} metres."
        )
    else:
        parts.append(f"Element {elem_id} is classified as a {type_label}.")

    # Sentence 2: Why top material wins
    why = traits_top.get("why", f"{top['name']} scored highest overall")
    parts.append(
        f"{top['name']} is the top recommendation (score {top['score']}) because {why}."
    )

    # Sentence 3: Span-specific reasoning
    if span and span > 5:
        parts.append(
            f"For a span of {span:.1f}m, high tensile capacity is mandatory — only Steel Frame and RCC qualify under standard structural codes."
        )
    elif elem_type == "LOAD_BEARING":
        parts.append(
            f"As a load-bearing element, the scoring model heavily weights strength (50%) and durability (30%), which favours {top['name']}."
        )
    elif elem_type == "PARTITION":
        parts.append(
            f"For partitions, cost-efficiency is prioritised (50% weight) while maintaining adequate durability, making {top['name']} the optimal choice."
        )

    # Sentence 4: Tradeoff vs runner-up
    if runner_up:
        tradeoff = traits_top.get("tradeoff", "it may be more expensive")
        parts.append(
            f"Compared to the runner-up {runner_up['name']} (score {runner_up['score']}), {top['name']} scores higher, though {tradeoff}."
        )

    # Sentence 5: Third option mention
    if third:
        parts.append(
            f"{third['name']} (score {third['score']}) remains a viable budget-conscious alternative if project constraints allow reduced structural margins."
        )

    return " ".join(parts)


def _try_deepseek(element, materials):
    """Attempt a DeepSeek API call; returns None on any failure."""
    api_key = os.environ.get("DEEPSEEK_API_KEY")
    if not api_key:
        return None

    try:
        from openai import OpenAI

        client = OpenAI(
            api_key=api_key,
            base_url="https://api.deepseek.com",
        )

        system_prompt = """You are a structural engineering assistant. You will be given details 
about a wall or structural element and the top 3 recommended materials 
for it. Your job is to explain the recommendation in 4-5 sentences that 
a non-expert can understand. Always cite:
- The wall type (load-bearing or partition)
- The span length if relevant
- Why the top material scored highest
- What the tradeoff is vs the cheaper or weaker option
Be specific. Never say a material is "good" without saying why.
Respond with ONLY a raw JSON object: { "explanation": "<your explanation>" }"""

        materials_text = "\n".join(
            [f"  {i+1}. {m['name']} — score: {m['score']}" for i, m in enumerate(materials)]
        )

        user_prompt = f"""Element: {element.get('id', element.get('element_id'))}
Type: {element.get('type')}
Span: {element.get('span_metres', 0)} metres
Top materials ranked:
{materials_text}

Explain the recommendation."""

        response = client.chat.completions.create(
            model="deepseek-chat",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            max_tokens=300,
            temperature=0.7,
        )

        text = response.choices[0].message.content.strip()
        text = text.replace("```json", "").replace("```", "").strip()
        try:
            parsed = json.loads(text)
            return parsed.get("explanation", text)
        except json.JSONDecodeError:
            return text

    except Exception as e:
        print(f"[DeepSeek] API error: {e}")
        return None  # Silently fall back to offline engine


def generate_explanation(element, materials):
    """Try DeepSeek first; seamlessly fall back to offline engine."""
    result = _try_deepseek(element, materials)
    if result:
        return result
    return _offline_explanation(element, materials)


def explain_all_recommendations(recommendations):
    explanations = []

    for rec in recommendations:
        element = {
            "id": rec["element_id"],
            "type": rec["type"],
            "span_metres": rec["span_metres"],
        }
        text = generate_explanation(element, rec["materials"])
        explanations.append({"element_id": rec["element_id"], "explanation": text})

    return explanations
