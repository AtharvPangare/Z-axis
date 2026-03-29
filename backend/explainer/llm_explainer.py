import os
import json
import anthropic

def generate_explanation(element, materials):
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        return "Anthropic API key not found. Please set ANTHROPIC_API_KEY environment variable. We recommend using RCC for load-bearing and AAC for partitions as a fallback."
        
    client = anthropic.Anthropic(api_key=api_key)

    system_prompt = """
    You are a structural engineering assistant. You will be given details 
    about a wall or structural element and the top 3 recommended materials 
    for it. Your job is to explain the recommendation in 4-5 sentences that 
    a non-expert can understand. Always cite:
    - The wall type (load-bearing or partition)
    - The span length if relevant
    - Why the top material scored highest
    - What the tradeoff is vs the cheaper or weaker option
    Be specific. Never say a material is "good" without saying why.
    
    CRITICAL: You MUST respond ONLY with a raw JSON object and no other text or explanation. Use this exact format:
    { "explanation": "<your detailed explanation here>" }
    """

    materials_text = "\n".join([f"    {i+1}. {m['name']} — score: {m['score']}" for i, m in enumerate(materials)])

    user_prompt = f"""
    Element: {element.get('id', element.get('element_id'))}
    Type: {element.get('type')}
    Span: {element.get('span_metres', 0)} metres
    Top materials ranked:
{materials_text}

    Explain the recommendation.
    """

    try:
        response = client.messages.create(
            model="claude-3-5-sonnet-20241022",
            max_tokens=300,
            system=system_prompt,
            messages=[
                {"role": "user", "content": user_prompt}
            ]
        )
        try:
            parsed = json.loads(response.content[0].text)
            return parsed.get("explanation", response.content[0].text)
        except json.JSONDecodeError:
            # Fallback if claude wraps in markdown
            text = response.content[0].text.replace("```json", "").replace("```", "").strip()
            try:
                return json.loads(text).get("explanation", text)
            except:
                return text
                
    except Exception as e:
        return f"Error generating explanation via Claude API: {str(e)}"

def explain_all_recommendations(recommendations):
    explanations = []
    
    for rec in recommendations:
        element = {
            "id": rec["element_id"],
            "type": rec["type"],
            "span_metres": rec["span_metres"]
        }
        text = generate_explanation(element, rec["materials"])
        explanations.append({
            "element_id": rec["element_id"],
            "explanation": text
        })
        
    return explanations
