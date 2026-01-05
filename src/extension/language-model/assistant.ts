import * as vscode from "vscode";
import * as utils from "@vscode/chat-extension-utils"

export async function assistantHandler(request: vscode.ChatRequest, context: vscode.ChatContext, stream: vscode.ChatResponseStream, token: vscode.CancellationToken) {
    if (request.command === "convert") {
        stream.markdown("converting...");
        return;
    }

    try {
        const result = utils.sendChatParticipantRequest(
            request,
            context,
            {
                // Use all tools (including non-lix ones) so general actions like file I/O remain available.
                tools: vscode.lm.tools,
                responseStreamOptions: {
                    stream,
                    responseText: true,
                    references: true
                },
                requestJustification: "请基于已有的上下文和工具调用，生成有帮助且准确的回复。",
            },
            token
        );

        // Return the ChatResult so tool-call metadata and errors propagate correctly.
        return await result.result;
    }
    catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        console.error("Assistant handler error:", e);
        // Gracefully surface error in the chat without throwing.
        stream.markdown(`$(error) Chat 出错：${message}`);
        return;
    }
}
