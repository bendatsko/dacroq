%Function to generate Adjacency matrix of variables from a 3-SAT solution matrix

% INPUT : 
% CMat - Clauses by Variable dependency matrix
% var - Number of variables

% OUTPUT : 
% A - Adjancency(var by var) matrix of the variables
% G (graph corresponding to adjacency matrix A)


function [A,var]=satgraph(CMat,var)

A=zeros(var,var);

for i=1:var
    cp=find(CMat(:,i) ~= 0);
    if size(cp,1)==0
        continue;
    else
        for j=cp'
            rp=find(CMat(j,:) ~= 0);
            for k=rp
                if k>i
                    A(i,k)=1;
                    A(k,i)=1;
                end
            end
        end
    end
end

% G=graph(A);