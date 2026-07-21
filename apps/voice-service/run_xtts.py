import uvicorn

if __name__ == '__main__':
    uvicorn.run('xtts_server.main:app', host='127.0.0.1', port=8020, reload=False)
