import ollama from 'ollama';
import { execSync } from 'child_process';

const System_Prompt = `
You are an expert AI Coding Agent. You must solve user queries by following a strict, sequential cycle of phases. You are strictly forbidden from generating multiple phases, extra keys, or nested objects. You must only output exactly ONE JSON object per response.

The mandatory cycle is:

1. **THINK (Step 1)**: Initial analysis of the user query. Identify the core requirements and potential obstacles.
2. **THINK (Step 2)**: Architectural planning. Decide on folder structures, file names, and the specific sequence of commands needed.
3. **THINK (Step 3)**: Final validation of the plan. Ensure the logic is sound and the commands are safe to execute.
4. **ACTION**: Execution phase. Call the "execute_command" tool with the specific string needed to perform the work.
5. **OBSERV**: Analysis phase. Examine the output of the command from the history to verify success or identify errors before proceeding.
6. **OUTPUT**: Final phase. Provide a summary of the completed task to the user.

Response Schema:
{
"role": "assistant",
"phase": "think" | "action" | "observ" | "output",
"context": "Briefly describe your current state or reasoning",
"tool": "execute_command" | null,
"tool_input": "command string" | null
}

Strict Rules:

1. Single Object Only: Never output more than one JSON object. Never include arrays of responses or multiple phases in one turn. Output ONLY the JSON, no extra text.
2. Valid JSON: Ensure the output is valid JSON that can be parsed. Do not include comments, extra text, or invalid syntax.
3. No Extra Keys: Do not include keys like "urls", "result", "next_phase", or "output". Stick exactly to the schema.
4. Turn-Based Execution: You generate one phase, then stop. You will receive the updated history before generating the next single phase.
5. History Awareness: Look at the last message. If it was THINK (Step 1), your response MUST be THINK (Step 2). If it was THINK (Step 3), your response MUST be ACTION. If it was ACTION, your response MUST be OBSERV. If it was OBSERV, your response MUST be OUTPUT.
6. Action Phase: "tool" and "tool_input" must only be populated during the "action" phase. In all other phases, they must be null.
7. Context Formatting: The "context" field must be a simple string, never a nested object or array.

Example of a correct single response:
{
"role": "assistant",
"phase": "think",
"context": "Step 1: Analyzing the request to create a Node.js backend.",
"tool": null,
"tool_input": null
`;

// 1. Define the actual tool
function execute_command(cmd) {
    try {
        const output = execSync(cmd).toString();
        return { output };
    } catch (error) {
        return { error: error.message };
    }
}

async function startAgent(query) {
    if (!query) {
        console.error("Query is required");
        return;
    }

    const history = [
        { role: "system", content: System_Prompt },
        { role: "user", content: query }
    ];

    let maxSteps = 10;

    while (maxSteps-- > 0) {
        const response = await ollama.chat({
            model: "llama3.2:latest",
            messages: history
        });

        const msg = response.message.content.trim();

        // Extract the first JSON object from the message
        const jsonMatch = msg.match(/\{[\s\S]*?\}/);
        if (!jsonMatch) {
            console.log("No JSON found in response:\n", msg);
            history.push({ role: "assistant", content: msg });
            continue;
        }

        let json;
        try {
            json = JSON.parse(jsonMatch[0]);
        } catch {
            console.log("Invalid JSON:\n", jsonMatch[0]);
            history.push({ role: "assistant", content: msg });
            continue;
        }

        // THINK
        if (json.phase === "think") {
            console.log(`💭 Think: ${json.context}`);
            history.push({
                role: "assistant",
                content: JSON.stringify(json)
            });
            continue;
        }

        // ACTION
        if (json.phase === "action" && json.tool === "execute_command") {
            console.log(`🔧 Action: ${json.context}`);
            const toolOutput = execute_command(json.tool_input);

            history.push({
                role: "assistant",
                content: JSON.stringify(json)
            });

            history.push({
                role: "system",
                content: `Tool Output:\n${JSON.stringify(toolOutput)}`
            });

            continue;
        }

        // OBSERV
        if (json.phase === "observ") {
            console.log(`👀 Observ: ${json.context}`);
            history.push({
                role: "assistant",
                content: JSON.stringify(json)
            });
            continue;
        }

        // FINAL OUTPUT
        if (json.phase === "output") {
            console.log("✅ Final Response:\n", json.context);
            break;
        }

        // Fallback
        history.push({
            role: "assistant",
            content: JSON.stringify(json)
        });
    }
}

startAgent("Make a simple todo application");
