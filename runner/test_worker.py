import unittest
from worker import Worker,sha,safe_path
class WorkerTests(unittest.TestCase):
 def test_protected_sources(self):
  for p in ['.env','Cargo.lock','tests/a.py','harness/a.py','src/config.ts','../x']:self.assertFalse(safe_path(p))
 def test_chain_parent_digest_and_commit(self):
  w=Worker.__new__(Worker);w.git=lambda *args:'original';w.apply=lambda *args:'accepted'
  snap={'originalCommit':'original','repository':{'commit':'accepted'},'recipe':{'protectedFiles':[],'calibration':{'harness':{}}},'chain':[{'baselineCommit':'original','candidateCommit':'accepted','patch':'real patch bytes','patchDigest':sha('real patch bytes')}]}
  self.assertEqual(w.restore_chain(None,snap),'accepted')
  snap['chain'][0]['patchDigest']='wrong'
  with self.assertRaises(ValueError):w.restore_chain(None,snap)
 def test_wrong_candidate_reconstruction(self):
  w=Worker.__new__(Worker);w.git=lambda *args:'original';w.apply=lambda *args:'different'
  snap={'originalCommit':'original','repository':{'commit':'accepted'},'recipe':{'protectedFiles':[],'calibration':{'harness':{}}},'chain':[{'baselineCommit':'original','candidateCommit':'accepted','patch':'p','patchDigest':sha('p')}]}
  with self.assertRaises(ValueError):w.restore_chain(None,snap)
if __name__=='__main__':unittest.main()
