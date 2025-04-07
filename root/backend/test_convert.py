import requests
import os

def test_convert_to_json():
    url = "http://localhost:5000/convert-to-json"
    
    # Prepare the files
    files = {
        'cnf_files': open('test.cnf', 'rb'),
        'csv_file': open('test.csv', 'rb')
    }
    
    data = {
        'batch_name': 'test_batch'
    }
    
    try:
        response = requests.post(url, files=files, data=data)
        response.raise_for_status()  # Raise an exception for bad status codes
        
        # Print the response
        print("Response Status Code:", response.status_code)
        print("Response JSON:", response.json())
        
    except requests.exceptions.RequestException as e:
        print("Error making request:", e)
    finally:
        # Close the files
        files['cnf_files'].close()
        files['csv_file'].close()

if __name__ == "__main__":
    test_convert_to_json() 