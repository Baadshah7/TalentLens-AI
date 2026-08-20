import asyncio
import websockets

URI = "ws://127.0.0.1:8000/interviews/ws/testroom"

async def client(name, messages):
    async with websockets.connect(URI) as ws:
        print(f"{name} connected")
        async def receiver():
            try:
                async for msg in ws:
                    print(f"{name} received: {msg}")
            except Exception as e:
                print(f"{name} receiver error: {e}")
        recv_task = asyncio.create_task(receiver())
        # send messages
        for m in messages:
            await asyncio.sleep(0.2)
            await ws.send(f"{name}: {m}")
        await asyncio.sleep(1)
        recv_task.cancel()

async def main():
    await asyncio.gather(
        client('ClientA', ['hello', 'how are you?']),
        client('ClientB', ['hi', "I'm fine"])
    )

if __name__ == '__main__':
    asyncio.run(main())
