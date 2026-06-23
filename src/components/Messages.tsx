import { MessageTurn, type TurnData } from "./MessageTurn.tsx";
import type { ThemeColors } from "../tui.tsx";

interface MessagesProps {
  messages: TurnData[];
  colors: ThemeColors;
}

export function Messages({ messages, colors }: MessagesProps) {
  return (
    <scrollbox id="messages" width="100%" flexGrow={1} scrollY stickyScroll stickyStart="bottom" viewportCulling>
      {messages.map((turn) => (
        <MessageTurn key={turn.id} turn={turn} colors={colors} />
      ))}
    </scrollbox>
  );
}
