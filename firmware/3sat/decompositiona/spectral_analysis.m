%Function that creates partition of variables based on spectral decomposition

% INPUT :
% A - Dependency matrix of variables
% S - The number of variables
% chip_size - Maximum number of variables in each chip

% OUTPUT : 
% partitions - Partition of variables such that each partition is <= chip_size

% this has no limitations

function partitions = spectral_analysis(A,S,chip_size)

    nodes =[1:S];
    partitions = recursive_partition(nodes,A,A,nodes,chip_size);
    fprintf("Size of partition :%d \n",size(partitions,2));
end

function partitions = recursive_partition(array,A,A_org,original_indices,chip_size)

    % Base case
    if length(array) <= chip_size
        partitions = {original_indices};
        return;
    end

    % Divide the array into two parts based on spectral method

    % Degree matrix
    D = diag(sum(A, 2));

    % Normalized Laplacian
    % L_normalized = eye(size(A)) - D^(-1/2) * A * D^(-1/2);
    L_normalized = D^(-1/2) * A * D^(-1/2);

    [eigenvectors, eigenvalues] = eig(L_normalized);

    % Sort eigenvalues in ascending order
    [eigenvalues,pos] = sort(diag(eigenvalues),"descend");

    % Find positions of positive elements
    positive_indices = find(eigenvectors(:,pos(2)) > 0);

    % Find positions of negative elements
    negative_indices = find(eigenvectors(:,pos(2)) < 0);


    % Ensure partitions are sorted for consistency
    positive_indices = sort(positive_indices);
    negative_indices = sort(negative_indices);

    % Extract adjacency submatrices
    Apos = A(positive_indices, positive_indices);
    Aneg = A(negative_indices, negative_indices);

    % Map indices back to original input indices
    pos_mapped = original_indices(positive_indices);
    neg_mapped = original_indices(negative_indices);


    % Recursively partition each part
    partitions_left = recursive_partition(negative_indices,Aneg,A_org,neg_mapped,chip_size);
    partitions_right = recursive_partition(positive_indices,Apos,A_org,pos_mapped,chip_size);

    % Combine results
    partitions = [partitions_left, partitions_right];
end
