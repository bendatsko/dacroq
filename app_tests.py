#!/usr/bin/env python3
import unittest
import os
import json
import tempfile
import shutil
import io
import sqlite3
import sys
from pathlib import Path
from datetime import datetime, timedelta
from unittest.mock import patch, MagicMock

import pytest
from werkzeug.datastructures import FileStorage

# Import the Flask app
import app as app_module
from app import app, init_db, DB_PATH, UPLOAD_FOLDER, LARGE_DATA_FOLDER

class KSATApiTests(unittest.TestCase):
    """Test suite for KSAT API application"""
    
    @classmethod
    def setUpClass(cls):
        """Set up test environment once before all tests"""
        # Create test directories
        cls.test_dir = Path(tempfile.mkdtemp())
        cls.test_db_dir = cls.test_dir / "database"
        cls.test_uploads_dir = cls.test_dir / "uploads"
        cls.test_large_data_dir = cls.test_dir / "large_data"
        
        cls.test_db_dir.mkdir(exist_ok=True)
        cls.test_uploads_dir.mkdir(exist_ok=True)
        cls.test_large_data_dir.mkdir(exist_ok=True)
        
        # Set up test config
        cls.test_db_path = cls.test_db_dir / "test_ksat.db"
        
        # Patch the app's paths to use test paths
        app_module.DB_PATH = cls.test_db_path
        app_module.UPLOAD_FOLDER = cls.test_uploads_dir
        app_module.LARGE_DATA_FOLDER = cls.test_large_data_dir

        # Initialize the test database
        init_db()
        
        # Configure the Flask test client
        app.config['TESTING'] = True
        cls.client = app.test_client()
    
    @classmethod
    def tearDownClass(cls):
        """Clean up after all tests"""
        # Remove test directory and all its contents
        shutil.rmtree(cls.test_dir)
    
    def setUp(self):
        """Set up before each test"""
        # Clear the database tables
        conn = sqlite3.connect(str(self.test_db_path))
        cursor = conn.cursor()
        cursor.execute("DELETE FROM large_data")
        cursor.execute("DELETE FROM files")
        cursor.execute("DELETE FROM tests")
        conn.commit()
        conn.close()
        
        # Clear upload directories
        for file_path in self.test_uploads_dir.glob("*"):
            if file_path.is_file():
                file_path.unlink()
        
        for file_path in self.test_large_data_dir.glob("*"):
            if file_path.is_file():
                file_path.unlink()
    
    def test_health_check(self):
        """Test the health check endpoint"""
        response = self.client.get('/api/health')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertEqual(data['api_status'], 'online')
        self.assertEqual(data['db_status'], 'online')
        self.assertIn('timestamp', data)

    def test_home_endpoint(self):
        """Test the home endpoints"""
        # Test root endpoint
        response = self.client.get('/')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertEqual(data['name'], 'Dacroq K-SAT API')
        self.assertEqual(data['version'], '1.0')
        
        # Test /api/ endpoint
        response = self.client.get('/api/')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        self.assertEqual(data['name'], 'Dacroq K-SAT API')

    def test_create_test(self):
        """Test creating a new test"""
        test_data = {
            'name': 'Test Run 1',
            'chipType': 'TestChip',
            'environment': 'test',
            'extraField': 'should be in metadata'
        }
        
        response = self.client.post(
            '/api/tests',
            data=json.dumps(test_data),
            content_type='application/json'
        )
        
        self.assertEqual(response.status_code, 201)
        data = json.loads(response.data)
        
        # Verify response format
        self.assertIn('id', data)
        self.assertEqual(data['name'], test_data['name'])
        self.assertEqual(data['chipType'], test_data['chipType'])
        self.assertEqual(data['environment'], test_data['environment'])
        self.assertEqual(data['status'], 'queued')
        self.assertEqual(data['extraField'], test_data['extraField'])
        
        # Verify database entry
        conn = sqlite3.connect(str(self.test_db_path))
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM tests WHERE id = ?", (data['id'],))
        db_test = cursor.fetchone()
        conn.close()
        
        self.assertIsNotNone(db_test)
        self.assertEqual(db_test['name'], test_data['name'])
        self.assertEqual(db_test['chip_type'], test_data['chipType'])
        
        # Test validation
        invalid_data = {
            'name': 'Missing Fields'
            # Missing required fields
        }
        
        response = self.client.post(
            '/api/tests',
            data=json.dumps(invalid_data),
            content_type='application/json'
        )
        
        self.assertEqual(response.status_code, 400)
        
        return data['id']  # Return ID for use in other tests

    def test_get_tests(self):
        """Test retrieving tests"""
        # Create some test data
        test_data = [
            {
                'name': 'Production Test 1',
                'chipType': 'Chip1',
                'environment': 'production'
            },
            {
                'name': 'Production Test 2',
                'chipType': 'Chip2',
                'environment': 'production'
            },
            {
                'name': 'Development Test',
                'chipType': 'DevChip',
                'environment': 'development'
            }
        ]
        
        for data in test_data:
            self.client.post(
                '/api/tests',
                data=json.dumps(data),
                content_type='application/json'
            )
        
        # Test retrieval with environment filter
        response = self.client.get('/api/tests?environment=production')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        
        # Should return 2 production tests
        self.assertEqual(len(data), 2)
        self.assertEqual(data[0]['environment'], 'production')
        self.assertEqual(data[1]['environment'], 'production')
        
        # Test with different environment
        response = self.client.get('/api/tests?environment=development')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        
        # Should return 1 development test
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]['environment'], 'development')
        
        # Test with time range filter
        response = self.client.get('/api/tests?environment=production&timeRange=1000')  # 1 second
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        
        # All tests should be within the time range since we just created them
        self.assertEqual(len(data), 2)

    def test_get_single_test(self):
        """Test retrieving a single test"""
        # Create a test
        test_id = self.test_create_test()
        
        # Get the test
        response = self.client.get(f'/api/tests/{test_id}')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        
        self.assertEqual(data['id'], test_id)
        self.assertEqual(data['name'], 'Test Run 1')
        
        # Test non-existent ID
        response = self.client.get('/api/tests/nonexistent-id')
        self.assertEqual(response.status_code, 404)

    def test_update_test(self):
        """Test updating a test"""
        # Create a test
        test_id = self.test_create_test()
        
        # Update the test
        update_data = {
            'name': 'Updated Test Name',
            'status': 'running',
            'newField': 'New metadata value'
        }
        
        response = self.client.put(
            f'/api/tests/{test_id}',
            data=json.dumps(update_data),
            content_type='application/json'
        )
        
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        
        # Verify response
        self.assertEqual(data['id'], test_id)
        self.assertEqual(data['name'], 'Updated Test Name')
        self.assertEqual(data['status'], 'running')
        self.assertEqual(data['newField'], 'New metadata value')
        
        # Verify in database
        conn = sqlite3.connect(str(self.test_db_path))
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM tests WHERE id = ?", (test_id,))
        db_test = cursor.fetchone()
        conn.close()
        
        self.assertEqual(db_test['name'], 'Updated Test Name')
        self.assertEqual(db_test['status'], 'running')
        
        # Test non-existent ID
        response = self.client.put(
            '/api/tests/nonexistent-id',
            data=json.dumps(update_data),
            content_type='application/json'
        )
        self.assertEqual(response.status_code, 404)

    def test_delete_test(self):
        """Test deleting a test"""
        # Create a test
        test_id = self.test_create_test()
        
        # Delete the test
        response = self.client.delete(f'/api/tests/{test_id}')
        self.assertEqual(response.status_code, 204)
        
        # Verify it's gone
        conn = sqlite3.connect(str(self.test_db_path))
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM tests WHERE id = ?", (test_id,))
        count = cursor.fetchone()[0]
        conn.close()
        
        self.assertEqual(count, 0)
        
        # Test non-existent ID
        response = self.client.delete('/api/tests/nonexistent-id')
        self.assertEqual(response.status_code, 404)

    def test_file_upload(self):
        """Test file upload functionality"""
        # Create a test
        test_id = self.test_create_test()
        
        # Create a test file
        file_content = b'Test file content'
        
        # Create a fresh BytesIO for each request
        file = FileStorage(
            stream=io.BytesIO(file_content),
            filename='test.txt',
            content_type='text/plain'
        )
        
        # Upload the file
        response = self.client.post(
            '/api/upload',
            data={
                'files': file,
                'test_id': test_id
            },
            content_type='multipart/form-data'
        )
        
        self.assertEqual(response.status_code, 201)
        data = json.loads(response.data)
        
        # Verify response
        self.assertEqual(len(data['files']), 1)
        self.assertEqual(data['files'][0]['filename'], 'test.txt')
        self.assertEqual(data['files'][0]['test_id'], test_id)
        
        # Verify file exists
        file_path = Path(data['files'][0]['path'])
        self.assertTrue(file_path.exists())
        with open(file_path, 'rb') as f:
            self.assertEqual(f.read(), file_content)
        
        # Verify database entry
        conn = sqlite3.connect(str(self.test_db_path))
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM files WHERE test_id = ?", (test_id,))
        db_file = cursor.fetchone()
        conn.close()
        
        self.assertIsNotNone(db_file)
        self.assertEqual(db_file['filename'], 'test.txt')
        self.assertEqual(db_file['file_size'], len(file_content))
        
        # Test invalid file type - create fresh FileStorage
        invalid_file = FileStorage(
            stream=io.BytesIO(b'Invalid content'),
            filename='invalid.xyz',  # Not in ALLOWED_EXTENSIONS
            content_type='application/octet-stream'
        )
        
        response = self.client.post(
            '/api/upload',
            data={
                'files': invalid_file,
                'test_id': test_id
            },
            content_type='multipart/form-data'
        )
        
        data = json.loads(response.data)
        self.assertIn('errors', data)
        
        # Test invalid test_id - create fresh FileStorage
        valid_file = FileStorage(
            stream=io.BytesIO(file_content),
            filename='test2.txt',
            content_type='text/plain'
        )
        
        response = self.client.post(
            '/api/upload',
            data={
                'files': valid_file,
                'test_id': 'nonexistent-id'
            },
            content_type='multipart/form-data'
        )
        
        self.assertEqual(response.status_code, 404)

    def test_store_small_large_data(self):
        """Test storing small large data (stored as BLOB)"""
        # Create a test
        test_id = self.test_create_test()
        
        # Create small JSON data (less than 1MB)
        small_data = {
            'name': 'Small Test Data',
            'data_type': 'json',
            'test_id': test_id,
            'content': {
                'results': [{'id': i, 'value': f'test{i}'} for i in range(10)]
            }
        }
        
        response = self.client.post(
            '/api/large-data',
            data=json.dumps(small_data),
            content_type='application/json'
        )
        
        self.assertEqual(response.status_code, 201)
        data = json.loads(response.data)
        
        # Verify response
        data_id = data['id']
        self.assertEqual(data['name'], small_data['name'])
        self.assertEqual(data['data_type'], small_data['data_type'])
        self.assertEqual(data['storage_type'], 'blob')  # Should be stored as BLOB
        self.assertEqual(data['test_id'], test_id)
        
        # Verify database entry
        conn = sqlite3.connect(str(self.test_db_path))
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM large_data WHERE id = ?", (data_id,))
        db_data = cursor.fetchone()
        conn.close()
        
        self.assertIsNotNone(db_data)
        self.assertEqual(db_data['name'], small_data['name'])
        self.assertEqual(db_data['storage_type'], 'blob')
        self.assertIsNotNone(db_data['content'])
        self.assertIsNone(db_data['filepath'])  # No file path for BLOB storage
        
        return data_id

    def test_store_large_data(self):
        """Test storing large data (stored as file)"""
        # Create a test
        test_id = self.test_create_test()
        
        # Create large data (more than 1MB)
        large_content = {
            # Generate a large dictionary that will exceed 1MB when serialized
            'large_array': ['x' * 1000 for _ in range(1100)]
        }
        
        large_data = {
            'name': 'Large Test Data',
            'data_type': 'json',
            'test_id': test_id,
            'content': large_content
        }
        
        response = self.client.post(
            '/api/large-data',
            data=json.dumps(large_data),
            content_type='application/json'
        )
        
        self.assertEqual(response.status_code, 201)
        data = json.loads(response.data)
        
        # Verify response
        data_id = data['id']
        self.assertEqual(data['name'], large_data['name'])
        self.assertEqual(data['data_type'], large_data['data_type'])
        self.assertEqual(data['storage_type'], 'file')  # Should be stored as file
        self.assertEqual(data['test_id'], test_id)
        
        # Verify database entry
        conn = sqlite3.connect(str(self.test_db_path))
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM large_data WHERE id = ?", (data_id,))
        db_data = cursor.fetchone()
        conn.close()
        
        self.assertIsNotNone(db_data)
        self.assertEqual(db_data['name'], large_data['name'])
        self.assertEqual(db_data['storage_type'], 'file')
        self.assertIsNone(db_data['content'])  # No content for file storage
        self.assertIsNotNone(db_data['filepath'])
        
        # Verify file exists
        file_path = Path(db_data['filepath'])
        self.assertTrue(file_path.exists())
        
        # Check if file content matches
        with open(file_path, 'r') as f:
            file_content = json.load(f)
            self.assertEqual(len(file_content['large_array']), 1100)
        
        return data_id

    def test_get_blob_large_data(self):
        """Test retrieving large data stored as BLOB"""
        # Store small data as BLOB
        data_id = self.test_store_small_large_data()
        
        # Retrieve the data
        response = self.client.get(f'/api/large-data/{data_id}')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        
        # Verify response
        self.assertEqual(data['id'], data_id)
        self.assertEqual(data['name'], 'Small Test Data')
        self.assertEqual(data['data_type'], 'json')
        self.assertIn('content', data)
        self.assertIn('results', data['content'])
        self.assertEqual(len(data['content']['results']), 10)
        
        # Test download option
        response = self.client.get(f'/api/large-data/{data_id}?download=true')
        self.assertEqual(response.status_code, 200)
        self.assertIn('attachment; filename=', response.headers['Content-Disposition'])

    def test_get_file_large_data(self):
        """Test retrieving large data stored as file"""
        # Store large data as file
        data_id = self.test_store_large_data()
        
        # Retrieve the data
        response = self.client.get(f'/api/large-data/{data_id}')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        
        # Verify response
        self.assertEqual(data['id'], data_id)
        self.assertEqual(data['name'], 'Large Test Data')
        self.assertEqual(data['data_type'], 'json')
        self.assertIn('content', data)
        self.assertIn('large_array', data['content'])
        self.assertEqual(len(data['content']['large_array']), 1100)
        
        # Test download option
        response = self.client.get(f'/api/large-data/{data_id}?download=true')
        self.assertEqual(response.status_code, 200)
        self.assertIn('attachment; filename=', response.headers['Content-Disposition'])
    
    def test_get_nonexistent_large_data(self):
        """Test retrieving non-existent large data"""
        response = self.client.get('/api/large-data/nonexistent-id')
        self.assertEqual(response.status_code, 404)
    
    def test_invalid_large_data_requests(self):
        """Test invalid large data requests"""
        # Missing required fields
        invalid_data = {
            'name': 'Missing Fields'
            # Missing data_type and content
        }
        
        response = self.client.post(
            '/api/large-data',
            data=json.dumps(invalid_data),
            content_type='application/json'
        )
        
        self.assertEqual(response.status_code, 400)
        
        # Invalid test_id
        invalid_test_data = {
            'name': 'Invalid Test ID',
            'data_type': 'json',
            'test_id': 'nonexistent-id',
            'content': {'test': 'data'}
        }
        
        response = self.client.post(
            '/api/large-data',
            data=json.dumps(invalid_test_data),
            content_type='application/json'
        )
        
        self.assertEqual(response.status_code, 404)
    
    def test_text_large_data(self):
        """Test storing and retrieving text large data"""
        # Create a test
        test_id = self.test_create_test()
        
        # Create text data
        text_data = {
            'name': 'Text Test Data',
            'data_type': 'text',
            'test_id': test_id,
            'content': 'This is a test text content.\nWith multiple lines.\n' * 10
        }
        
        response = self.client.post(
            '/api/large-data',
            data=json.dumps(text_data),
            content_type='application/json'
        )
        
        self.assertEqual(response.status_code, 201)
        data = json.loads(response.data)
        data_id = data['id']
        
        # Retrieve the data
        response = self.client.get(f'/api/large-data/{data_id}')
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        
        # Verify response
        self.assertEqual(data['data_type'], 'text')
        self.assertEqual(data['content'], text_data['content'])
    
    def test_solve_endpoint(self):
        """Test the solve endpoint"""
        # Valid request
        solve_data = {
            'filename': 'test.cnf'
        }
        
        response = self.client.post(
            '/api/solve',
            data=json.dumps(solve_data),
            content_type='application/json'
        )
        
        self.assertEqual(response.status_code, 200)
        data = json.loads(response.data)
        
        self.assertIn('id', data)
        self.assertEqual(data['status'], 'completed')
        self.assertTrue(data['result']['satisfiable'])
        
        # Invalid request (missing filename)
        invalid_data = {}
        
        response = self.client.post(
            '/api/solve',
            data=json.dumps(invalid_data),
            content_type='application/json'
        )
        
        self.assertEqual(response.status_code, 400)
    
    def test_cascading_delete(self):
        """Test that deleting a test also deletes associated files and data"""
        # Create a test
        test_id = self.test_create_test()
        
        # Create a file
        file_content = b'Test file content'
        file = FileStorage(
            stream=io.BytesIO(file_content),
            filename='test.txt',
            content_type='text/plain'
        )
        
        file_response = self.client.post(
            '/api/upload',
            data={
                'files': file,
                'test_id': test_id
            },
            content_type='multipart/form-data'
        )
        file_data = json.loads(file_response.data)
        file_path = Path(file_data['files'][0]['path'])
        
        # Create large data
        large_data = {
            'name': 'Test Data',
            'data_type': 'json',
            'test_id': test_id,
            'content': {'test': 'data'}
        }
        
        data_response = self.client.post(
            '/api/large-data',
            data=json.dumps(large_data),
            content_type='application/json'
        )
        
        # Check that the file and data exist
        self.assertTrue(file_path.exists())
        
        conn = sqlite3.connect(str(self.test_db_path))
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM files WHERE test_id = ?", (test_id,))
        file_count = cursor.fetchone()[0]
        cursor.execute("SELECT COUNT(*) FROM large_data WHERE test_id = ?", (test_id,))
        data_count = cursor.fetchone()[0]
        conn.close()
        
        self.assertEqual(file_count, 1)
        self.assertEqual(data_count, 1)
        
        # Delete the test
        self.client.delete(f'/api/tests/{test_id}')
        
        # Check that the file and data are deleted
        self.assertFalse(file_path.exists())
        
        conn = sqlite3.connect(str(self.test_db_path))
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM files WHERE test_id = ?", (test_id,))
        file_count = cursor.fetchone()[0]
        cursor.execute("SELECT COUNT(*) FROM large_data WHERE test_id = ?", (test_id,))
        data_count = cursor.fetchone()[0]
        cursor.execute("SELECT COUNT(*) FROM tests WHERE id = ?", (test_id,))
        test_count = cursor.fetchone()[0]
        conn.close()
        
        self.assertEqual(file_count, 0)
        self.assertEqual(data_count, 0)
        self.assertEqual(test_count, 0)


# Test runner function
def run_tests():
    """Run the API tests and display results"""
    import sys
    import time
    
    # Custom test result to track passed/failed tests
    class DetailedTestResult(unittest.TextTestResult):
        def __init__(self, stream, descriptions, verbosity):
            super().__init__(stream, descriptions, verbosity)
            self.passed = []
            self.failed_details = []
            self.start_times = {}
            
        def startTest(self, test):
            super().startTest(test)
            self.start_times[test] = time.time()
            
        def addSuccess(self, test):
            super().addSuccess(test)
            elapsed = time.time() - self.start_times[test]
            self.passed.append((test, elapsed))
            
        def addFailure(self, test, err):
            super().addFailure(test, err)
            elapsed = time.time() - self.start_times[test]
            self.failed_details.append((test, err, elapsed))
    
    # Create a test suite from the KSATApiTests class
    suite = unittest.defaultTestLoader.loadTestsFromTestCase(KSATApiTests)
    
    # Run the tests with our custom result class
    test_result = unittest.TextTestRunner(resultclass=DetailedTestResult).run(suite)
    
    # Display summary
    total_tests = test_result.testsRun
    passed_tests = len(test_result.passed)
    failed_tests = len(test_result.failures) + len(test_result.errors)
    
    print("\n" + "="*70)
    print(f"TEST SUMMARY: {passed_tests}/{total_tests} tests passed ({passed_tests/total_tests*100:.1f}%)")
    print("="*70)
    
    # Show passed tests
    if test_result.passed:
        print("\nPASSED TESTS:")
        for test, elapsed in test_result.passed:
            print(f"✅ {test._testMethodName} ({elapsed:.3f}s)")
    
    # Show failed tests with details
    if test_result.failed_details:
        print("\nFAILED TESTS:")
        for test, err, elapsed in test_result.failed_details:
            print(f"❌ {test._testMethodName} ({elapsed:.3f}s)")
            print(f"   ERROR: {err[0].__name__}: {err[1]}")
            
    print("\n" + "="*70)
    
    # Return exit code based on success/failure
    return 0 if failed_tests == 0 else 1


if __name__ == '__main__':
    sys.exit(run_tests())
