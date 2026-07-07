from pathlib import Path

from backend.config import Settings, _ENV_FILE


def test_env_file_path_is_absolute_and_lives_in_backend():
    path = Path(_ENV_FILE)
    assert path.is_absolute()
    assert path.name == ".env"
    assert path.parent.name == "backend"


def test_env_file_loads_regardless_of_process_cwd(tmp_path, monkeypatch):
    env_file = tmp_path / "fake.env"
    env_file.write_text("NEWSAPI_KEY=test-key-from-fake-env\n")

    monkeypatch.setitem(Settings.model_config, "env_file", str(env_file))
    # cwd is somewhere with no relation to the env file's directory — this is
    # exactly the "started from the repo root" scenario that broke before.
    monkeypatch.chdir(tmp_path.parent)

    settings = Settings()
    assert settings.newsapi_key == "test-key-from-fake-env"
