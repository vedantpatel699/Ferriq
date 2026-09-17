import importlib.util
import pathlib
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[2]
ENGINE_PATH = ROOT / "python" / "air_blower" / "engine.py"

spec = importlib.util.spec_from_file_location("air_blower_engine", ENGINE_PATH)
engine = importlib.util.module_from_spec(spec)
assert spec and spec.loader
spec.loader.exec_module(engine)


class AirBlowerReferenceDataTests(unittest.TestCase):
    def test_reference_csv_processes_200_rows(self):
        rows = engine.load_csv(ROOT / "reference" / "blower-demo.csv")
        self.assertEqual(len(rows), 200)

        batch = engine.process_batch(rows)
        self.assertEqual(batch["rows_processed"], 200)
        self.assertEqual(batch["rows_dropped"], 0)

        first = batch["results"][0]
        latest = batch["results"][-1]

        for result in (first, latest):
            self.assertEqual(result["active_blower"], "A")
            self.assertTrue(550 < result["power_kw"] < 750)
            self.assertTrue(0.8 < result["dp_bar"] < 1.0)
            self.assertTrue(1.9 < result["pressure_ratio"] < 2.1)
            self.assertTrue(40 < result["efficiency_fluid_pct"] < 85)
            self.assertEqual(result["t1_source"], "measured")
            self.assertTrue(result["efficiency_polytropic_pct"] > 0)
            self.assertTrue(result["thrust_proxy_pct"] >= 0)

    def test_performance_model_uses_time_window_and_operating_envelope(self):
        batch = engine.process_batch(
            engine.load_csv(ROOT / "reference" / "blower-demo.csv")
        )
        results = batch["results"]

        trained = [
            r for r in results
            if r.get("performance_model_training_rows", 0) > 0
        ]
        self.assertTrue(trained)
        self.assertGreater(trained[0]["performance_model_training_rows"], 14)

        off_envelope = next(
            r for r in results
            if r.get("bypass_op_pct") is not None
            and r["bypass_op_pct"]
            >= engine.DEFAULT_SETTINGS["performance_bypass_max_pct"]
        )
        self.assertFalse(off_envelope["performance_model_applicable"])
        self.assertIsNone(off_envelope["performance_degradation_pct"])


if __name__ == "__main__":
    unittest.main()
