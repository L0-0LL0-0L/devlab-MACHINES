import unittest
import os,tempfile,pathlib,base64
from worker import Worker,sha,safe_path,patch_paths,contained,tree_modes,require_regular
import devlab_enroll
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
class GuardTests(unittest.TestCase):
 def test_index_modes(self):
  ok='diff --git a/src/a.py b/src/a.py\nindex 1234567..89abcde 100644\n--- a/src/a.py\n+++ b/src/a.py\n'
  self.assertEqual(patch_paths(ok,[]),{'src/a.py'})
  for mode in ('120000','160000','100755'):
   with self.assertRaises(ValueError):patch_paths(ok.replace('100644',mode),[])
  with self.assertRaises(ValueError):patch_paths(ok.replace('index 1234567..89abcde 100644\n','similarity index 90%\ncopy from src/b.py\ncopy to src/a.py\n'),[])
 def test_contained_rejects_symlink_ancestor(self):
  with tempfile.TemporaryDirectory() as d,tempfile.TemporaryDirectory() as out:
   root=pathlib.Path(d);(root/'src').mkdir();(root/'src/a.py').write_text('x')
   os.symlink(out,root/'link');os.symlink('/etc/passwd',root/'src/p.py')
   self.assertEqual(contained(root,'src/a.py'),(root/'src/a.py').resolve())
   for bad in ('link/x.py','src/p.py','src/../../x'):
    with self.assertRaises(ValueError):contained(root,bad)
 def test_tree_modes(self):
  m=tree_modes('100644 blob aa\tsrc/a.py\x00120000 blob bb\tsrc/l.py\x00160000 commit cc\tvendor/sub\x00')
  require_regular(m,'src/a.py')
  for p in ('src/l.py','vendor/sub','missing.py'):
   with self.assertRaises(ValueError):require_regular(m,p)
class EnrollTests(unittest.TestCase):
 def test_keygen_and_sign(self):
  with tempfile.TemporaryDirectory() as d:
   path=pathlib.Path(d)/'k';pub=devlab_enroll.keygen(path)
   self.assertEqual(oct(path.stat().st_mode&0o777),'0o600');self.assertEqual(len(base64.b64decode(pub)),32)
   with self.assertRaises(SystemExit):devlab_enroll.keygen(path)
   key=devlab_enroll.load(path);msg='devlab-runner-enrollment-v1\nchallenge:x\nkey:'+pub
   sig=base64.b64decode(devlab_enroll.sign_challenge(key,msg));key.verify_key.verify(msg.encode(),sig)
   with self.assertRaises(SystemExit):devlab_enroll.sign_challenge(key,msg.replace(pub,'A'*43+'='))
   with self.assertRaises(SystemExit):devlab_enroll.sign_challenge(key,'other\nkey:'+pub)
if __name__=='__main__':unittest.main()
