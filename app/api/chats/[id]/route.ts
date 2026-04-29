import { NextRequest, NextResponse } from "next/server";
import { getChatWithMessages, updateChat, deleteChat, addMessage } from "../store";

type Params = { params: Promise<{ id: string }> };

// GET /api/chats/[id]?userId=xxx
export async function GET(request: NextRequest, { params }: Params) {
  const userId = request.nextUrl.searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });
  const { id } = await params;
  const chat = await getChatWithMessages(userId, id);
  if (!chat) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(chat);
}

// PATCH /api/chats/[id]
export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const body = await request.json();
  const userId = body.userId;
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });
  const { userId: _, ...updates } = body;
  const updated = await updateChat(userId, id, updates);
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(updated);
}

// DELETE /api/chats/[id]?userId=xxx
export async function DELETE(request: NextRequest, { params }: Params) {
  const userId = request.nextUrl.searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });
  const { id } = await params;
  const ok = await deleteChat(userId, id);
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

// POST /api/chats/[id] — add a message
export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const body = await request.json();
  const { userId, role, content } = body;
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });
  if (!role || !content) {
    return NextResponse.json({ error: "role and content required" }, { status: 400 });
  }
  const chat = await addMessage(userId, id, { role, content });
  if (!chat) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(chat);
}
